import { AdminHeader } from "@/components/admin-header"

export default function CustomerDetailsLoading() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-50/80">
      <div className="flex flex-col sm:gap-4 sm:py-4">
        <AdminHeader title="Customer Details" />
        <main className="mx-auto w-full max-w-[1800px] flex-1 space-y-4 p-3 sm:p-5 lg:p-6" aria-label="Opening customer details">
          <div className="h-10 w-40 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-56 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />)}
          </div>
          <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        </main>
      </div>
    </div>
  )
}
