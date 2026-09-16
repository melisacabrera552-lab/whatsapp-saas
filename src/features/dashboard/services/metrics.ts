// Dashboard metrics — service role queries (no RLS needed for aggregates)

import { createClient as createSbClient } from "@supabase/supabase-js";
import type { ConversationState } from "@/features/inbox/types";

function svc() {
  return createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export interface WorkspaceMetrics {
  messagesToday: number;
  activeConversations: number;
  handoffPending: number;
  llmCostWeekUsd: number;
  templatesSentWeek: number;
}

export interface RecentConversation {
  id: string;
  contactName: string | null;
  contactPhone: string;
  lastMessagePreview: string | null;
  state: ConversationState;
  lastMessageAt: string | null;
}

// Rough $/token estimate for cost display (blended model avg)
const USD_PER_TOKEN = 0.000_002;

export async function getWorkspaceMetrics(
  workspaceId: string,
): Promise<WorkspaceMetrics> {
  const supabase = svc();

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const weekStart = new Date();
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);
  weekStart.setUTCHours(0, 0, 0, 0);

  const [
    messagesResult,
    activeResult,
    handoffResult,
    llmEventsResult,
    templatesResult,
  ] = await Promise.all([
    // Messages today (all directions)
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .gte("created_at", todayStart.toISOString()),

    // Active conversations
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .in("state", ["ai_active", "human_active"]),

    // Handoff pending
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("state", "handoff_pending"),

    // LLM usage events this week
    supabase
      .from("events")
      .select("payload")
      .eq("workspace_id", workspaceId)
      .eq("type", "llm_usage")
      .gte("created_at", weekStart.toISOString()),

    // Templates sent this week
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("type", "template")
      .gte("created_at", weekStart.toISOString()),
  ]);

  const totalTokensWeek = (llmEventsResult.data ?? []).reduce((sum, row) => {
    const payload = row.payload as Record<string, unknown> | null;
    const t = payload?.total_tokens;
    return sum + (typeof t === "number" ? t : 0);
  }, 0);

  return {
    messagesToday: messagesResult.count ?? 0,
    activeConversations: activeResult.count ?? 0,
    handoffPending: handoffResult.count ?? 0,
    llmCostWeekUsd: totalTokensWeek * USD_PER_TOKEN,
    templatesSentWeek: templatesResult.count ?? 0,
  };
}

export async function getRecentConversations(
  workspaceId: string,
  limit = 5,
): Promise<RecentConversation[]> {
  const supabase = svc();

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("conversations")
    .select(
      `
      id,
      state,
      last_message_at,
      contacts!inner(name, phone),
      messages(body, direction, created_at)
    `,
    )
    .eq("workspace_id", workspaceId)
    .gte("last_message_at", todayStart.toISOString())
    .order("last_message_at", { ascending: false })
    .limit(limit);

  if (!data) return [];

  return data.map((row) => {
    const contact = Array.isArray(row.contacts)
      ? row.contacts[0]
      : row.contacts;
    const msgs = Array.isArray(row.messages) ? row.messages : [];
    const lastMsg = msgs.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )[0];

    return {
      id: row.id,
      contactName: (contact as { name: string | null })?.name ?? null,
      contactPhone: (contact as { phone: string })?.phone ?? "",
      lastMessagePreview: lastMsg?.body ?? null,
      state: row.state as ConversationState,
      lastMessageAt: row.last_message_at,
    };
  });
}

// ============================================
// WhatsApp monthly outbound usage (Meta pricing, effective 2026-10-01)
// ============================================

// Meta gives every business phone number 1.000 free service messages per
// calendar month. The quota does not roll over and is not shared between
// numbers. Ref: YCloud pricing update effective 2026-10-01.
const FREE_SERVICE_MESSAGES_PER_MONTH = 1_000;

// Indicative Argentina utility/service rate in USD per delivered message.
// Meta refreshes its rate card quarterly, so this is an estimate, not a bill.
const SERVICE_MESSAGE_USD = 0.012;

// Date the per-message billing for service messages kicks in.
const PRICING_START = Date.UTC(2026, 9, 1); // 2026-10-01

export interface WhatsappMonthlyUsage {
  monthLabel: string;
  /** Outbound non-template messages — these consume the free quota. */
  serviceMessages: number;
  /** Outbound template messages — always billed, never part of the quota. */
  templateMessages: number;
  freeQuota: number;
  freeRemaining: number;
  billableMessages: number;
  estimatedCostUsd: number;
  /** Straight-line projection of serviceMessages to the end of the month. */
  projectedServiceMessages: number;
  projectedCostUsd: number;
  previousMonthServiceMessages: number;
  /** False until 2026-10-01 — before that, service messages are still free. */
  pricingActive: boolean;
}

function countBillable(serviceMessages: number): number {
  return Math.max(0, serviceMessages - FREE_SERVICE_MESSAGES_PER_MONTH);
}

/**
 * Counts the outbound WhatsApp messages the workspace sent this calendar month
 * and projects them against Meta's free service-message quota.
 *
 * Only delivered messages count towards Meta's billing, so failed sends and
 * internal 'system' rows are excluded. Template messages are reported apart
 * because they are billed from the first one, outside the quota.
 */
export async function getWhatsappMonthlyUsage(
  workspaceId: string,
): Promise<WhatsappMonthlyUsage> {
  const supabase = svc();

  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const previousMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );

  const outbound = () =>
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("direction", "out")
      .neq("type", "system")
      .or("status.is.null,status.neq.failed");

  const [serviceResult, templateResult, previousServiceResult] =
    await Promise.all([
      outbound()
        .neq("type", "template")
        .gte("created_at", monthStart.toISOString()),

      outbound()
        .eq("type", "template")
        .gte("created_at", monthStart.toISOString()),

      outbound()
        .neq("type", "template")
        .gte("created_at", previousMonthStart.toISOString())
        .lt("created_at", monthStart.toISOString()),
    ]);

  const serviceMessages = serviceResult.count ?? 0;
  const templateMessages = templateResult.count ?? 0;

  // Straight-line projection: today's daily average held to the month's end.
  const daysInMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const dayOfMonth = now.getUTCDate();
  const projectedServiceMessages = Math.round(
    (serviceMessages / dayOfMonth) * daysInMonth,
  );

  const billableMessages = countBillable(serviceMessages);

  return {
    monthLabel: monthStart.toLocaleDateString("es", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
    serviceMessages,
    templateMessages,
    freeQuota: FREE_SERVICE_MESSAGES_PER_MONTH,
    freeRemaining: Math.max(
      0,
      FREE_SERVICE_MESSAGES_PER_MONTH - serviceMessages,
    ),
    billableMessages,
    estimatedCostUsd: billableMessages * SERVICE_MESSAGE_USD,
    projectedServiceMessages,
    projectedCostUsd:
      countBillable(projectedServiceMessages) * SERVICE_MESSAGE_USD,
    previousMonthServiceMessages: previousServiceResult.count ?? 0,
    pricingActive: Date.now() >= PRICING_START,
  };
}
