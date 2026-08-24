// "use client"

// import { useEffect, useMemo, useState } from "react"
// import {
//   collection,
//   onSnapshot,
//   query,
//   where,
//   Timestamp,
// } from "firebase/firestore"
// import { getFirestoreDb } from "@/lib/firebase"

// import {
//   Card,
//   CardContent,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card"

// type Partner = {
//   id: string
//   joinDate: Date
//   status: string
// }

// interface PartnerStatsProps {
//   fromDate?: string
//   toDate?: string
// }

// export function PartnerStats({ fromDate, toDate }: PartnerStatsProps) {
//   const db = getFirestoreDb()
//   const [partners, setPartners] = useState<Partner[]>([])

//   /* ---------------- SAFE DATE PARSER ---------------- */

//   const parseDate = (dateStr?: string) => {
//     if (!dateStr) return null
//     const parts = dateStr.split("/")
//     if (parts.length !== 3) return null

//     const [month, day, year] = parts
//     return new Date(Number(year), Number(month) - 1, Number(day))
//   }

// const startDate = fromDate ? new Date(fromDate) : null
// const endDate = toDate ? new Date(toDate) : null

// if (endDate) {
//   endDate.setHours(23, 59, 59, 999)
// }

//   /* ---------------- REALTIME FETCH ---------------- */

//   useEffect(() => {
//     const providerQuery = query(
//       collection(db, "customer"),
//       where("userType.provider", "==", true)
//     )

//     const agencyQuery = query(
//       collection(db, "customer"),
//       where("userType.AgencyPartner", "==", true)
//     )

//     let providers: any[] = []
//     let agencies: any[] = []

//     const rebuild = () => {
//       const allDocs = [...providers, ...agencies]

//       const data: Partner[] = allDocs.map((docSnap) => {
//         const d = docSnap.data()

//         return {
//           id: docSnap.id,
//           joinDate:
//             d.created_time instanceof Timestamp
//               ? d.created_time.toDate()
//               : new Date(0),
//           status: d.partner_status || "Information_Unverified",
//         }
//       })

//       setPartners(data)
//     }

//     const unsubProvider = onSnapshot(providerQuery, (snap) => {
//       providers = snap.docs
//       rebuild()
//     })

//     const unsubAgency = onSnapshot(agencyQuery, (snap) => {
//       agencies = snap.docs
//       rebuild()
//     })

//     return () => {
//       unsubProvider()
//       unsubAgency()
//     }
//   }, [db])

//   /* ---------------- DATE FILTER ONLY ---------------- */

// const dateFilteredPartners = useMemo(() => {
//   if (!startDate || !endDate) return partners

//   return partners.filter((p) => {
//     const joined = new Date(p.joinDate)

//     return joined >= startDate && joined <= endDate
//   })
// }, [partners, fromDate, toDate])

//   /* ---------------- STATS ---------------- */

//   const totalPartners = dateFilteredPartners.length

//   const onboardedPartners = dateFilteredPartners.filter(
//     (p) => p.status === "Onboarded"
//   ).length

//   const unverifiedPartners = dateFilteredPartners.filter(
//     (p) => p.status === "Information_Unverified"
//   ).length

//   const otherStatusPartners = dateFilteredPartners.filter(
//     (p) =>
//       p.status !== "Onboarded" &&
//       p.status !== "Information_Unverified"
//   ).length

//   /* ---------------- UI ---------------- */

//   return (
//     <div className="grid gap-4 md:grid-cols-4">
//       <Card>
//         <CardHeader>
//           <CardTitle>Total Partners</CardTitle>
//         </CardHeader>
//         <CardContent>
//           <div className="text-3xl font-bold">{totalPartners}</div>
//           <p className="text-xs text-muted-foreground">
//             Based on selected date range
//           </p>
//         </CardContent>
//       </Card>

//       <Card>
//         <CardHeader>
//           <CardTitle>Onboarded</CardTitle>
//         </CardHeader>
//         <CardContent>
//           <div className="text-3xl font-bold text-green-600">
//             {onboardedPartners}
//           </div>
//         </CardContent>
//       </Card>

//       <Card>
//         <CardHeader>
//           <CardTitle>Unverified</CardTitle>
//         </CardHeader>
//         <CardContent>
//           <div className="text-3xl font-bold text-red-600">
//             {unverifiedPartners}
//           </div>
//         </CardContent>
//       </Card>

//       <Card>
//         <CardHeader>
//           <CardTitle>Other Status</CardTitle>
//         </CardHeader>
//         <CardContent>
//           <div className="text-3xl font-bold text-blue-600">
//             {otherStatusPartners}
//           </div>
//         </CardContent>
//       </Card>
//     </div>
//   )
// }

"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import {
  collection,
  onSnapshot,
  query,
  where,
  Timestamp,
} from "firebase/firestore"

import {
  Users,
  UserCheck,
  UserX,
  MoreHorizontal,
  MapPin,
  ArrowRight,
  Activity,
} from "lucide-react"

import { getFirestoreDb } from "@/lib/firebase"

import {
  Card,
  CardContent,
} from "@/components/ui/card"

/* ============================================================
   TYPES
============================================================ */

type Partner = {
  id: string
  joinDate: Date
  status: string
}

interface PartnerStatsProps {
  fromDate?: string
  toDate?: string
}

/* ============================================================
   COMPONENT
============================================================ */

export function PartnerStats({
  fromDate,
  toDate,
}: PartnerStatsProps) {
  const db = getFirestoreDb()
  const router = useRouter()

  const [partners, setPartners] = useState<Partner[]>([])

  /* ==========================================================
     SAFE DATE PARSER
  ========================================================== */

  const parseDate = (dateStr?: string) => {
    if (!dateStr) return null

    const parts = dateStr.split("/")

    if (parts.length !== 3) return null

    const [month, day, year] = parts

    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    )
  }

  const startDate = fromDate
    ? new Date(fromDate)
    : null

  const endDate = toDate
    ? new Date(toDate)
    : null

  if (endDate) {
    endDate.setHours(
      23,
      59,
      59,
      999
    )
  }

  /* ==========================================================
     REALTIME FETCH
  ========================================================== */

  useEffect(() => {
    const providerQuery = query(
      collection(db, "customer"),
      where(
        "userType.provider",
        "==",
        true
      )
    )

    const agencyQuery = query(
      collection(db, "customer"),
      where(
        "userType.AgencyPartner",
        "==",
        true
      )
    )

    let providers: any[] = []
    let agencies: any[] = []

    const rebuild = () => {
      const allDocs = [
        ...providers,
        ...agencies,
      ]

      const data: Partner[] =
        allDocs.map((docSnap) => {
          const d = docSnap.data()

          return {
            id: docSnap.id,

            joinDate:
              d.created_time instanceof Timestamp
                ? d.created_time.toDate()
                : new Date(0),

            status:
              d.partner_status ||
              "Information_Unverified",
          }
        })

      setPartners(data)
    }

    const unsubProvider =
      onSnapshot(
        providerQuery,
        (snap) => {
          providers = snap.docs
          rebuild()
        }
      )

    const unsubAgency =
      onSnapshot(
        agencyQuery,
        (snap) => {
          agencies = snap.docs
          rebuild()
        }
      )

    return () => {
      unsubProvider()
      unsubAgency()
    }
  }, [db])

  /* ==========================================================
     DATE FILTER ONLY
  ========================================================== */

  const dateFilteredPartners =
    useMemo(() => {
      if (
        !startDate ||
        !endDate
      ) {
        return partners
      }

      return partners.filter(
        (partner) => {
          const joined =
            new Date(
              partner.joinDate
            )

          return (
            joined >= startDate &&
            joined <= endDate
          )
        }
      )
    }, [
      partners,
      fromDate,
      toDate,
    ])

  /* ==========================================================
     STATS
  ========================================================== */

  const totalPartners =
    dateFilteredPartners.length

  const onboardedPartners =
    dateFilteredPartners.filter(
      (partner) =>
        partner.status ===
        "Onboarded"
    ).length

  const unverifiedPartners =
    dateFilteredPartners.filter(
      (partner) =>
        partner.status ===
        "Information_Unverified"
    ).length

  const otherStatusPartners =
    dateFilteredPartners.filter(
      (partner) =>
        partner.status !==
          "Onboarded" &&
        partner.status !==
          "Information_Unverified"
    ).length

  /* ==========================================================
     UI
  ========================================================== */

  return (
    <div className="space-y-4">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-800">
            Partner Overview
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Monitor partner onboarding, verification and live operations
          </p>
        </div>

        {/* REALTIME BADGE */}

        <div className="flex w-fit items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5">

          <span className="relative flex h-2 w-2">

            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />

            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />

          </span>

          <Activity className="h-3.5 w-3.5 text-emerald-600" />

          <span className="text-[11px] font-semibold text-emerald-700">
            Realtime
          </span>

        </div>

      </div>

      {/* ======================================================
          CARDS
      ====================================================== */}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">

        {/* ====================================================
            LIVE PARTNER TRACKING
        ==================================================== */}

        <Card
          onClick={() =>
            router.push(
              "/partners/live-tracking"
            )
          }
          className="group relative cursor-pointer overflow-hidden border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-emerald-50 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300 hover:shadow-lg"
        >

          <CardContent className="p-5">

            <div className="flex items-start justify-between">

              {/* MAP ICON */}

              <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-100">

                <MapPin className="h-5 w-5 text-cyan-700" />

                {/* LIVE DOT */}

                <span className="absolute -right-1 -top-1 flex h-3 w-3">

                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />

                  <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />

                </span>

              </div>

              {/* ARROW */}

              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-100 bg-white text-cyan-700 transition-all duration-300 group-hover:bg-cyan-600 group-hover:text-white">

                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />

              </div>

            </div>

            {/* CONTENT */}

            <div className="mt-5">

              <div className="flex items-center gap-2">

                <span className="relative flex h-2 w-2">

                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />

                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />

                </span>

                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                  Live Tracking
                </span>

              </div>

              <p className="mt-2 text-sm font-bold text-slate-800">
                Partner Live Location
              </p>

              <p className="mt-1 text-[11px] leading-4 text-slate-500">
                Map par sabhi partners ki current location dekhein
              </p>

            </div>

          </CardContent>

          {/* BOTTOM GRADIENT */}

          <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-cyan-500 to-emerald-500" />

        </Card>

        {/* ====================================================
            TOTAL PARTNERS
        ==================================================== */}

        <Card className="group relative overflow-hidden border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">

          <CardContent className="p-5">

            <div className="flex items-start justify-between">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50">

                <Users className="h-5 w-5 text-blue-600" />

              </div>

              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-600">
                TOTAL
              </span>

            </div>

            <div className="mt-5">

              <div className="text-3xl font-bold tracking-tight text-slate-900">
                {totalPartners}
              </div>

              <p className="mt-1 text-sm font-semibold text-slate-700">
                Total Partners
              </p>

              <p className="mt-1 text-[11px] leading-4 text-slate-400">
                Based on selected date range
              </p>

            </div>

          </CardContent>

          <div className="absolute bottom-0 left-0 h-1 w-full bg-blue-500" />

        </Card>

        {/* ====================================================
            ONBOARDED
        ==================================================== */}

        <Card className="group relative overflow-hidden border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">

          <CardContent className="p-5">

            <div className="flex items-start justify-between">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50">

                <UserCheck className="h-5 w-5 text-emerald-600" />

              </div>

              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-600">
                ACTIVE
              </span>

            </div>

            <div className="mt-5">

              <div className="text-3xl font-bold tracking-tight text-emerald-600">
                {onboardedPartners}
              </div>

              <p className="mt-1 text-sm font-semibold text-slate-700">
                Onboarded
              </p>

              <p className="mt-1 text-[11px] leading-4 text-slate-400">
                Verified service partners
              </p>

            </div>

          </CardContent>

          <div className="absolute bottom-0 left-0 h-1 w-full bg-emerald-500" />

        </Card>

        {/* ====================================================
            UNVERIFIED
        ==================================================== */}

        <Card className="group relative overflow-hidden border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">

          <CardContent className="p-5">

            <div className="flex items-start justify-between">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50">

                <UserX className="h-5 w-5 text-rose-500" />

              </div>

              <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-semibold text-rose-500">
                PENDING
              </span>

            </div>

            <div className="mt-5">

              <div className="text-3xl font-bold tracking-tight text-rose-500">
                {unverifiedPartners}
              </div>

              <p className="mt-1 text-sm font-semibold text-slate-700">
                Unverified
              </p>

              <p className="mt-1 text-[11px] leading-4 text-slate-400">
                Partner verification pending
              </p>

            </div>

          </CardContent>

          <div className="absolute bottom-0 left-0 h-1 w-full bg-rose-500" />

        </Card>

        {/* ====================================================
            OTHER STATUS
        ==================================================== */}

        <Card className="group relative overflow-hidden border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">

          <CardContent className="p-5">

            <div className="flex items-start justify-between">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50">

                <MoreHorizontal className="h-5 w-5 text-violet-600" />

              </div>

              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-600">
                OTHER
              </span>

            </div>

            <div className="mt-5">

              <div className="text-3xl font-bold tracking-tight text-violet-600">
                {otherStatusPartners}
              </div>

              <p className="mt-1 text-sm font-semibold text-slate-700">
                Other Status
              </p>

              <p className="mt-1 text-[11px] leading-4 text-slate-400">
                Other partner states
              </p>

            </div>

          </CardContent>

          <div className="absolute bottom-0 left-0 h-1 w-full bg-violet-500" />

        </Card>

        

      </div>

    </div>
  )
}