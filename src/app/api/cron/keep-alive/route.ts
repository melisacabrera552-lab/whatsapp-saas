import { NextResponse } from "next/server";
import { pingDatabase } from "@/shared/lib/keep-alive";

// ──────────────────────────────────────────────────────────────────────────────
// Mantiene activa la base de Supabase (el plan gratuito pausa proyectos tras
// 7 dias sin actividad). Hace un SELECT liviano de solo-lectura — no escribe
// nada ni interfiere con el SaaS.
//
// Agendado vía pg_cron + pg_net (ver supabase/cron/schedule-keep-alive.sql),
// NO vía vercel.json — mismo patrón que /api/cron/buffer-flush. Vercel agrega
// el header Authorization: Bearer {CRON_SECRET} solo para crons nativos de
// Vercel; acá el propio job de pg_cron manda ese mismo header.
// ──────────────────────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await pingDatabase();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ts: new Date().toISOString() });
}
