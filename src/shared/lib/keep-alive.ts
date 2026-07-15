import { createClient as createSbClient } from "@supabase/supabase-js";

// ──────────────────────────────────────────────────────────────────────────────
// Service-role Supabase client — only used inside lib/, never in routes
// ──────────────────────────────────────────────────────────────────────────────
function svc() {
  return createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// pingDatabase
// Lectura minima de solo-lectura (sin INSERT/UPDATE/DELETE) para contar como
// "user database activity" ante Supabase y evitar la pausa por inactividad del
// plan gratuito (7 dias sin actividad). No crea datos, no dispara triggers, no
// toca logica de negocio.
// ──────────────────────────────────────────────────────────────────────────────
export async function pingDatabase(): Promise<{ ok: boolean; error?: string }> {
  const { error } = await svc().from("workspaces").select("id").limit(1);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
