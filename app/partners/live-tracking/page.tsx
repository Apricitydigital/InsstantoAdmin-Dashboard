// import { PartnerLiveLocation } from "@/components/partners/partner-live-location"

// export default function PartnerLiveTrackingPage() {
//   return <PartnerLiveLocation />
// }

// import { PartnerLiveLocation } from "@/components/partners/partner-live-location"

// export default function PartnerLiveTrackingPage() {
//   return (
//     <PartnerLiveLocation />
//   )
// }

import { PartnerLiveLocation } from "@/components/partners/partner-live-location"
import { AdminSidebar } from "@/components/admin-sidebar"

export default function PartnerLiveTrackingPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F9FC]">

      {/* EXISTING ADMIN SIDEBAR */}
      <AdminSidebar />

      {/* MAIN AREA */}
      <div className="flex min-w-0 flex-1 flex-col">

        {/* HEADER */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">

          <div>
            <h2 className="text-lg font-semibold text-slate-700">
              Partner Management
            </h2>

            <p className="text-[11px] text-slate-400">
              Live Partner Tracking
            </p>
          </div>

          <div className="rounded-full bg-cyan-50 px-3 py-1.5 text-[10px] font-semibold text-cyan-700">
            Live Operations
          </div>

        </header>

        {/* LIVE TRACKING */}
        <main className="min-h-0 flex-1 overflow-hidden">
          <PartnerLiveLocation />
        </main>

      </div>

    </div>
  )
}