"use client";

import { actionSignOut } from "@/lib/server-actions";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();

  async function onClick() {
    await actionSignOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-semibold text-stone-500 underline-offset-2 hover:underline"
    >
      Sign out
    </button>
  );
}
