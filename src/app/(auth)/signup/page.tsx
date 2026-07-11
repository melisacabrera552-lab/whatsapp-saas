import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupForm } from "@/features/auth/components/signup-form";
import { isSignupOpen } from "@/features/auth/services/signup-gate";

export const metadata: Metadata = {
  title: "Crear cuenta — Agente WhatsApp",
};

// El gate de invite-only depende del estado vivo de la DB (cuenta usuarios).
// Si Next la prerenderiza como estática, el resultado queda congelado en el
// build y el signup podría seguir "abierto" en el HTML servido después del
// primer registro.
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  // Invite-only after bootstrap: once the admin account exists, no public signup.
  if (!(await isSignupOpen())) {
    redirect(
      "/login?message=El%20registro%20es%20solo%20por%20invitaci%C3%B3n",
    );
  }

  return <SignupForm />;
}
