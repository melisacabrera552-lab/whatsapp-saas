"use client";

import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WhatsappMonthlyUsage } from "@/features/dashboard/services/metrics";

interface WhatsappUsageCardProps {
  usage: WhatsappMonthlyUsage;
}

function formatUsd(usd: number): string {
  return `USD ${usd.toFixed(2).replace(".", ",")}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString("es");
}

/** Green under the quota, amber when the projection crosses it, red once over. */
function quotaTone(usage: WhatsappMonthlyUsage) {
  if (usage.serviceMessages > usage.freeQuota) {
    return { bar: "bg-destructive", text: "text-destructive" };
  }
  if (usage.projectedServiceMessages > usage.freeQuota) {
    return { bar: "bg-warning", text: "text-warning" };
  }
  return { bar: "bg-primary", text: "text-primary" };
}

function TrendPill({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;

  const deltaPct = Math.round(((current - previous) / previous) * 100);
  const Icon = deltaPct > 0 ? TrendingUp : deltaPct < 0 ? TrendingDown : Minus;

  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Icon className="h-3 w-3" aria-hidden="true" />
      {deltaPct > 0 ? "+" : ""}
      {deltaPct}% vs. mes pasado
    </span>
  );
}

export function WhatsappUsageCard({ usage }: WhatsappUsageCardProps) {
  const tone = quotaTone(usage);
  const pct = Math.min(
    100,
    Math.round((usage.serviceMessages / usage.freeQuota) * 100),
  );

  const willExceed = usage.projectedServiceMessages > usage.freeQuota;

  return (
    <section className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-sm font-semibold text-foreground">
            Mensajes de WhatsApp en {usage.monthLabel}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Meta regala 1.000 mensajes de servicio por mes y por número. No se
            acumulan de un mes al otro.
          </p>
        </div>
        <TrendPill
          current={usage.serviceMessages}
          previous={usage.previousMonthServiceMessages}
        />
      </div>

      {/* Quota bar */}
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-display text-2xl font-semibold text-foreground tabular-nums">
            {formatNumber(usage.serviceMessages)}
            <span className="text-sm font-normal text-muted-foreground">
              {" "}
              / {formatNumber(usage.freeQuota)} gratis
            </span>
          </p>
          <p className={cn("text-xs font-medium tabular-nums", tone.text)}>
            {usage.freeRemaining > 0
              ? `Quedan ${formatNumber(usage.freeRemaining)}`
              : `${formatNumber(usage.billableMessages)} por encima`}
          </p>
        </div>

        <div
          className="h-2 w-full rounded-full bg-muted overflow-hidden"
          role="progressbar"
          aria-valuenow={usage.serviceMessages}
          aria-valuemin={0}
          aria-valuemax={usage.freeQuota}
          aria-label="Cuota gratuita de mensajes de servicio"
        >
          <div
            className={cn("h-full rounded-full transition-all", tone.bar)}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Breakdown */}
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-1">
        <div>
          <dt className="text-xs text-muted-foreground">Proyección a fin de mes</dt>
          <dd className="text-sm font-medium text-foreground tabular-nums mt-0.5">
            {formatNumber(usage.projectedServiceMessages)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Templates enviados</dt>
          <dd className="text-sm font-medium text-foreground tabular-nums mt-0.5">
            {formatNumber(usage.templateMessages)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            {usage.pricingActive ? "Costo estimado" : "Costo si ya se cobrara"}
          </dt>
          <dd className="text-sm font-medium text-foreground tabular-nums mt-0.5">
            {formatUsd(usage.estimatedCostUsd)}
          </dd>
        </div>
      </dl>

      {/* Contextual note */}
      <p className="text-xs text-muted-foreground border-t border-border/30 pt-3">
        {!usage.pricingActive ? (
          <>
            Hoy los mensajes de servicio son gratis. Desde el{" "}
            <strong className="text-foreground">1 de octubre de 2026</strong>{" "}
            Meta cobra por mensaje entregado a partir del 1.001.{" "}
            {willExceed
              ? `A este ritmo vas a superar la cuota y el mes costaría ${formatUsd(usage.projectedCostUsd)}.`
              : "A este ritmo el mes entra dentro de la cuota gratuita."}
          </>
        ) : willExceed ? (
          <>
            A este ritmo el mes cierra en{" "}
            {formatNumber(usage.projectedServiceMessages)} mensajes ={" "}
            <strong className="text-foreground">
              {formatUsd(usage.projectedCostUsd)}
            </strong>
            . Respuestas más cortas y en un solo mensaje bajan este número.
          </>
        ) : (
          <>A este ritmo el mes entra dentro de la cuota gratuita.</>
        )}{" "}
        Tarifa estimada de USD 0,012 por mensaje (Argentina); Meta la actualiza
        cada trimestre.
      </p>
    </section>
  );
}
