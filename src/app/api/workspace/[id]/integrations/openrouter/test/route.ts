import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/auth/workspace-access";
import { getOpenRouterApiKey } from "@/features/inbox/services/openrouter";

type OpenRouterKeyResponse = {
  data?: {
    label?: string;
    usage?: number;
    limit?: number | null;
    limit_remaining?: number | null;
    is_free_tier?: boolean;
  };
};

/**
 * Checks the OpenRouter key the agent actually uses (workspace credential, with
 * the env var as fallback) against /api/v1/key. Lets the settings UI tell an
 * invalid key apart from an exhausted budget without waiting for a WhatsApp
 * round trip. Never returns the key itself.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workspaceId } = await params;

  const auth = await requireWorkspaceMember(workspaceId);
  if (!auth.ok) return auth.response;

  const apiKey = await getOpenRouterApiKey(workspaceId);
  if (!apiKey || apiKey === "placeholder") {
    return NextResponse.json({ ok: false, error: "No hay API key configurada" });
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (res.ok) {
      const json = (await res.json()) as OpenRouterKeyResponse;
      return NextResponse.json({
        ok: true,
        usage: json.data?.usage ?? null,
        limit: json.data?.limit ?? null,
        limitRemaining: json.data?.limit_remaining ?? null,
        isFreeTier: json.data?.is_free_tier ?? null,
      });
    }

    if (res.status === 401) {
      return NextResponse.json({
        ok: false,
        error:
          "OpenRouter rechazó la clave (401). Está vencida o fue borrada: creá una nueva en openrouter.ai y pegala acá.",
      });
    }

    return NextResponse.json({
      ok: false,
      error: `OpenRouter respondió ${res.status}`,
    });
  } catch (err) {
    console.error(
      "[integrations/openrouter/test] fetch error:",
      err instanceof Error ? err.message : "unknown",
    );
    return NextResponse.json({ ok: false, error: "No se pudo contactar a OpenRouter" });
  }
}
