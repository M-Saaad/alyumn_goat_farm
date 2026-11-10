export default function TransactionsLoading() {
  return (
    <main className="px-4 pt-6">
      <div className="mb-4 h-16 animate-pulse rounded-xl bg-stone-200" />
      <div className="mb-4 h-12 animate-pulse rounded-xl bg-stone-200" />
      <div className="space-y-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-stone-200" />
        ))}
      </div>
    </main>
  );
}
