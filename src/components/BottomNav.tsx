import Link from "next/link";

const tabs = [
  { href: "/", label: "Finance", active: "finance" as const },
  { href: "/animals", label: "Goats", active: "goats" as const },
  { href: "/transactions", label: "Txns", active: "txns" as const },
];

export function BottomNav({ active }: { active: "finance" | "goats" | "txns" }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-emerald-900/20 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-lg">
        {tabs.map((t) => {
          const isActive = active === t.active;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex-1 py-3 text-center text-sm font-semibold ${
                isActive ? "text-emerald-800" : "text-stone-500"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
