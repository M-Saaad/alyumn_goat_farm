export function ViewOnlyBanner() {
  return (
    <div
      className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900"
      role="status"
    >
      <p className="font-semibold">View-only guest access</p>
      <p className="text-sky-800">You can browse farm data but cannot add, edit, or delete records.</p>
    </div>
  );
}
