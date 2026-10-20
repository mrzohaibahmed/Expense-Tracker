export default function DashboardLoading() {
  return <main className="mx-auto max-w-6xl animate-pulse space-y-5 px-4 py-8" aria-busy="true" aria-label="Loading dashboard">
    <div className="h-9 w-48 rounded bg-stone-200" /><div className="grid gap-4 sm:grid-cols-2"><div className="h-44 rounded-3xl bg-stone-200" /><div className="h-44 rounded-3xl bg-stone-200" /></div><div className="grid gap-4 sm:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-28 rounded-2xl bg-stone-200" />)}</div>
  </main>;
}
