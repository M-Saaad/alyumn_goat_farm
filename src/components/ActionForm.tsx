"use client";

import {
  createContext,
  useContext,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

type ActionFormContextValue = {
  pending: boolean;
};

const ActionFormContext = createContext<ActionFormContextValue>({ pending: false });

export function useActionFormPending() {
  return useContext(ActionFormContext).pending;
}

export function ActionForm({
  action,
  onSuccess,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<void | { ok?: boolean; error?: string; warning?: string }>;
  onSuccess?: () => void;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setError(null);
    setWarning(null);
    startTransition(async () => {
      try {
        const result = await action(fd);
        if (result && typeof result === "object" && "ok" in result && result.ok === false) {
          setError(result.error ?? "Something went wrong");
          return;
        }
        if (result && typeof result === "object" && "error" in result && result.error) {
          setError(result.error);
          return;
        }
        router.refresh();
        if (result && typeof result === "object" && "warning" in result && result.warning) {
          setWarning(result.warning);
          return;
        }
        onSuccess?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <ActionFormContext.Provider value={{ pending }}>
      <form onSubmit={onSubmit} className={className}>
        {error && (
          <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </p>
        )}
        {warning && (
          <p className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
            {warning}
          </p>
        )}
        <fieldset disabled={pending} className="min-w-0 space-y-3 border-0 p-0">
          {children}
        </fieldset>
      </form>
    </ActionFormContext.Provider>
  );
}

export function SubmitButton({
  label = "Save",
  pendingLabel = "Saving…",
  className,
}: {
  label?: string;
  pendingLabel?: string;
  className?: string;
}) {
  const pending = useActionFormPending();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        className ??
        "w-full rounded-xl bg-emerald-700 py-3 text-base font-semibold text-white disabled:opacity-60"
      }
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
