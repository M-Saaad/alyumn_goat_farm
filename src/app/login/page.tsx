import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col justify-center px-4">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Farm App</p>
        <h1 className="text-2xl font-bold text-stone-900">Partner login</h1>
        <p className="mt-1 text-sm text-stone-500">Monis &amp; Saad only</p>
      </header>
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <Suspense fallback={<p className="text-sm text-stone-500">Loading…</p>}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
