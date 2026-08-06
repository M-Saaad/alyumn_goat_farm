import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen flex-col justify-center px-4">
      <header className="mb-6 flex flex-col items-center text-center">
        <Logo size="lg" className="mb-4" />
        <h1 className="text-2xl font-bold text-stone-900">Set new password</h1>
        <p className="mt-1 text-sm text-stone-500">Use the link from your reset email first</p>
      </header>
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <Suspense fallback={<p className="text-sm text-stone-500">Loading…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </section>
    </main>
  );
}
