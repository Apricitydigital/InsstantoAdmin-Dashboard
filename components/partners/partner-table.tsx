// "use client"

// import { useEffect, useMemo, useState } from "react"
// import Link from "next/link"
// import {
//   collection,
//   getDocs,
//   onSnapshot,
//   query,
//   where,
//   Timestamp,
// } from "firebase/firestore"
// import { getFirestoreDb } from "@/lib/firebase"

// import {
//   Card,
//   CardContent,
//   CardDescription,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card"
// import { Badge } from "@/components/ui/badge"
// import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input"
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "@/components/ui/table"
// import {
//   DropdownMenu,
//   DropdownMenuTrigger,
//   DropdownMenuContent,
//   DropdownMenuItem,
// } from "@/components/ui/dropdown-menu"

// import { Search, Eye, Download } from "lucide-react"

// /* ------------------------------------------------------------------ */
// /* CONSTANTS */
// /* ------------------------------------------------------------------ */

// const STATUS_OPTIONS = [
//   "All",
//   "DocumentsUploaded",
//   "Onboarded",
//   "Information_Verified",
//   "Id_Generated",
//   "RegistrationFormFilled",
//   "Information_Unverified",
// ] as const

// type StatusFilter = typeof STATUS_OPTIONS[number]

// /* ------------------------------------------------------------------ */
// /* TYPES */
// /* ------------------------------------------------------------------ */

// type Partner = {
//   id: string
//   display_name: string
//   phone_number: string
//   type: "provider" | "agency"
//   joinDate: string
//   status: string
//   serviceOptName: string | null
//   partner_serviceOpt?: string | null
// }

// interface PartnerTableProps {
//   fromDate: string
//   toDate: string
// }

// /* ------------------------------------------------------------------ */
// /* UTILS */
// /* ------------------------------------------------------------------ */

// const chunkArray = <T,>(arr: T[], size = 10) =>
//   Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
//     arr.slice(i * size, i * size + size)
//   )

// /* ------------------------------------------------------------------ */
// /* COMPONENT */
// /* ------------------------------------------------------------------ */

// export function PartnerTable({ fromDate, toDate }: PartnerTableProps) {
//   const db = getFirestoreDb()

//   const [partners, setPartners] = useState<Partner[]>([])
//   const [serviceMap, setServiceMap] = useState<Record<string, string>>({})

//   const [searchTerm, setSearchTerm] = useState("")
//   const [typeFilter, setTypeFilter] =
//     useState<"all" | "provider" | "agency">("all")
//   const [partnerIdFilter, setPartnerIdFilter] =
//     useState<"all" | "specific">("all")
//   const [statusFilter, setStatusFilter] =
//     useState<StatusFilter>("All")

//   const [loading, setLoading] = useState(false)

//   /* ---------------- DATE RANGE ---------------- */

//   const startDate = new Date(fromDate)
//   const endDate = new Date(toDate)
//   endDate.setHours(23, 59, 59, 999)

//   /* ------------------------------------------------------------------ */
//   /* REALTIME LISTENER (providers + agencies) */
//   /* ------------------------------------------------------------------ */

//   useEffect(() => {
//     setLoading(true)

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

//     const rebuildPartners = async () => {
//       const allDocs = [...providers, ...agencies]

//       // Collect service ids
//       const serviceIds = Array.from(
//         new Set(allDocs.map((d) => d.data()?.partner_serviceOpt).filter(Boolean))
//       ) as string[]

//       // Fetch service_subcategories names (getDocs is OK here)
//       const newServiceMap: Record<string, string> = {}
//       const chunks = chunkArray(serviceIds)

//       await Promise.all(
//         chunks.map(async (ids) => {
//           if (ids.length === 0) return
//           const snap = await getDocs(
//             query(
//               collection(db, "service_subcategories"),
//               where("__name__", "in", ids)
//             )
//           )
//           snap.forEach((doc) => {
//             newServiceMap[doc.id] = (doc.data() as any)?.name
//           })
//         })
//       )

//       setServiceMap(newServiceMap)

//       const data: Partner[] = allDocs.map((docSnap) => {
//         const d = docSnap.data()
//         return {
//           id: docSnap.id,
//           display_name: d.display_name || "Unknown",
//           phone_number: d.phone_number || "N/A",
//           type: d.userType?.AgencyPartner ? "agency" : "provider",
//           joinDate:
//             d.created_time instanceof Timestamp
//               ? d.created_time.toDate().toISOString()
//               : new Date(0).toISOString(),
//           status: d.partner_status || "Information_Unverified",
//           partner_serviceOpt: d.partner_serviceOpt || null,
//           serviceOptName: d.partner_serviceOpt
//             ? newServiceMap[d.partner_serviceOpt] || "Unknown"
//             : null,
//         }
//       })

//       data.sort(
//         (a, b) =>
//           new Date(b.joinDate).getTime() - new Date(a.joinDate).getTime()
//       )

//       setPartners(data)
//       setLoading(false)
//     }

//     const unsubProvider = onSnapshot(providerQuery, (snap) => {
//       providers = snap.docs
//       rebuildPartners()
//     })

//     const unsubAgency = onSnapshot(agencyQuery, (snap) => {
//       agencies = snap.docs
//       rebuildPartners()
//     })

//     return () => {
//       unsubProvider()
//       unsubAgency()
//     }
//   }, [db])

//   /* ---------------- FILTERING ---------------- */

//   const filteredPartners = useMemo(() => {
//     return partners.filter((p) => {
//       const joined = new Date(p.joinDate)

//       const matchesDate = joined >= startDate && joined <= endDate

//       const matchesSearch =
//         p.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
//         p.phone_number.includes(searchTerm) ||
//         p.serviceOptName?.toLowerCase().includes(searchTerm.toLowerCase())

//       const matchesType =
//         typeFilter === "all" ||
//         (typeFilter === "provider" && p.type === "provider") ||
//         (typeFilter === "agency" && p.type === "agency")

//       const matchesPartnerIds =
//         partnerIdFilter === "all" ||

//       const matchesStatus =
//         statusFilter === "All" || p.status === statusFilter

//       return (
//         matchesDate &&
//         matchesSearch &&
//         matchesType &&
//         matchesPartnerIds &&
//         matchesStatus
//       )
//     })
//   }, [
//     partners,
//     searchTerm,
//     typeFilter,
//     partnerIdFilter,
//     statusFilter,
//     fromDate,
//     toDate,
//   ])

//   /* ---------------- EXPORT ---------------- */

//   const exportCSV = () => {
//     const headers = [
//       "Partner ID",
//       "Name",
//       "Phone",
//       "Type",
//       "Service Opt",
//       "Join Date",
//       "Status",
//     ]

//     const rows = filteredPartners.map((p) => [
//       p.id,
//       p.display_name,
//       p.phone_number,
//       p.type,
//       p.serviceOptName || "N/A",
//       new Date(p.joinDate).toLocaleDateString("en-IN"),
//       p.status,
//     ])

//     const csv =
//       [headers, ...rows]
//         .map((row) => row.map((v) => `"${v}"`).join(","))
//         .join("\n")

//     const blob = new Blob([csv], { type: "text/csv" })
//     const url = URL.createObjectURL(blob)

//     const a = document.createElement("a")
//     a.href = url
//     a.download = `partners_${fromDate}_to_${toDate}.csv`
//     a.click()

//     URL.revokeObjectURL(url)
//   }

//   /* ---------------- UI ---------------- */

//   return (
//     <Card>
//       <CardHeader>
//         <div className="flex items-center justify-between">
//           <div>
//             <CardTitle>Partner Management</CardTitle>
//             <CardDescription>
//               Showing {filteredPartners.length} partners
//               {loading && <span className="ml-2 text-xs">(loading...)</span>}
//             </CardDescription>
//           </div>

//           <Button variant="outline" onClick={exportCSV}>
//             <Download className="h-4 w-4 mr-2" />
//             Export
//           </Button>
//         </div>

//         <div className="flex flex-wrap gap-3 pt-4">
//           <div className="relative max-w-sm flex-1">
//             <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
//             <Input
//               placeholder="Search partner..."
//               value={searchTerm}
//               onChange={(e) => setSearchTerm(e.target.value)}
//               className="pl-8"
//             />
//           </div>

//           {/* TYPE */}
//           <DropdownMenu>
//             <DropdownMenuTrigger asChild>
//               <Button variant="outline">Type: {typeFilter}</Button>
//             </DropdownMenuTrigger>
//             <DropdownMenuContent>
//               <DropdownMenuItem onClick={() => setTypeFilter("all")}>All</DropdownMenuItem>
//               <DropdownMenuItem onClick={() => setTypeFilter("provider")}>Provider</DropdownMenuItem>
//               <DropdownMenuItem onClick={() => setTypeFilter("agency")}>Agency</DropdownMenuItem>
//             </DropdownMenuContent>
//           </DropdownMenu>

//           {/* PARTNER IDS */}
//           <DropdownMenu>
//             <DropdownMenuTrigger asChild>
//               <Button variant="outline">
//                 Partner IDs: {partnerIdFilter === "all" ? "All" : "Specific"}
//               </Button>
//             </DropdownMenuTrigger>
//             <DropdownMenuContent>
//               <DropdownMenuItem onClick={() => setPartnerIdFilter("all")}>
//                 All
//               </DropdownMenuItem>
//               <DropdownMenuItem onClick={() => setPartnerIdFilter("specific")}>
//                 Specific
//               </DropdownMenuItem>
//             </DropdownMenuContent>
//           </DropdownMenu>

//           {/* STATUS */}
//           <DropdownMenu>
//             <DropdownMenuTrigger asChild>
//               <Button variant="outline">Status: {statusFilter}</Button>
//             </DropdownMenuTrigger>
//             <DropdownMenuContent>
//               {STATUS_OPTIONS.map((s) => (
//                 <DropdownMenuItem
//                   key={s}
//                   onClick={() => setStatusFilter(s)}
//                 >
//                   {s}
//                 </DropdownMenuItem>
//               ))}
//             </DropdownMenuContent>
//           </DropdownMenu>
//         </div>
//       </CardHeader>

//       <CardContent>
//         <div className="rounded-md border">
//           <Table exportable={false}>
//             <TableHeader>
//               <TableRow>
//                 <TableHead>Partner</TableHead>
//                 <TableHead>Type</TableHead>
//                 <TableHead>Contact</TableHead>
//                 <TableHead>Service Opt</TableHead>
//                 <TableHead>Join Date</TableHead>
//                 <TableHead>Status</TableHead>
//                 <TableHead />
//               </TableRow>
//             </TableHeader>

//             <TableBody>
//               {filteredPartners.map((p) => (
//                 <TableRow key={p.id}>
//                   <TableCell>
//                     <div className="font-medium">{p.display_name}</div>
//                     <div className="text-xs text-muted-foreground">{p.id}</div>
//                   </TableCell>
//                   <TableCell>
//                     <Badge variant="secondary">{p.type}</Badge>
//                   </TableCell>
//                   <TableCell>{p.phone_number}</TableCell>
//                   <TableCell>
//                     {p.serviceOptName ? (
//                       <Badge variant="outline">{p.serviceOptName}</Badge>
//                     ) : (
//                       <span className="text-xs text-muted-foreground">N/A</span>
//                     )}
//                   </TableCell>
//                   <TableCell>
//                     {new Date(p.joinDate).toLocaleDateString("en-IN")}
//                   </TableCell>
//                   <TableCell>
//                     <Badge variant="outline">{p.status}</Badge>
//                   </TableCell>
//                   <TableCell>
//                     <Link href={`/partners/${p.id}`}>
//                       <Button size="icon" variant="ghost">
//                         <Eye className="h-4 w-4" />
//                       </Button>
//                     </Link>
//                   </TableCell>
//                 </TableRow>
//               ))}
//             </TableBody>
//           </Table>
//         </div>

//         {filteredPartners.length === 0 && (
//           <div className="py-8 text-center text-muted-foreground">
//             No partners found
//           </div>
//         )}
//       </CardContent>
//     </Card>
//   )
// }
"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
  Timestamp,
} from "firebase/firestore"

import { getFirestoreDb } from "@/lib/firebase"
import { useAuth } from "@/lib/auth"
import { useToast } from "@/hooks/use-toast"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
  Search,
  Eye,
  Download,
  Users,
  Building2,
  User,
  Phone,
  Briefcase,
  CalendarDays,
  ChevronDown,
  SlidersHorizontal,
  RotateCcw,
  Loader2,
} from "lucide-react"

import { ONBOARDED_PARTNER_STATUS } from "@/lib/queries/partners"

/* ============================================================
   CONSTANTS
============================================================ */

const STATUS_OPTIONS = [
  "All",
  "DocumentsUploaded",
  "Onboarded",
  "Information_Verified",
  "Id_Generated",
  "RegistrationFormFilled",
  "Information_Unverified",
] as const

type StatusFilter = (typeof STATUS_OPTIONS)[number]
type PartnerStatus = Exclude<StatusFilter, "All">

/* ============================================================
   TYPES
============================================================ */

type Partner = {
  id: string
  display_name: string
  phone_number: string
  type: "provider" | "agency"
  joinDate: string
  status: string
  serviceOptName: string | null
  partner_serviceOpt?: string | null
}

interface PartnerTableProps {
  fromDate: string
  toDate: string
}

/* ============================================================
   UTILS
============================================================ */

const chunkArray = <T,>(arr: T[], size = 10) =>
  Array.from(
    {
      length: Math.ceil(arr.length / size),
    },
    (_, i) => arr.slice(i * size, i * size + size)
  )

const formatStatus = (status: string) => {
  return status
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
}

const getInitials = (name: string) => {
  if (!name || name === "Unknown") {
    return "P"
  }

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
}

/* ============================================================
   COMPONENT
============================================================ */

export function PartnerTable({
  fromDate,
  toDate,
}: PartnerTableProps) {
  const db = getFirestoreDb()
  const { user } = useAuth()
  const { toast } = useToast()

  const [partners, setPartners] = useState<Partner[]>([])

  const [serviceMap, setServiceMap] = useState<
    Record<string, string>
  >({})

  const [searchTerm, setSearchTerm] = useState("")

  const [typeFilter, setTypeFilter] = useState<
    "all" | "provider" | "agency"
  >("all")

  const [partnerIdFilter, setPartnerIdFilter] = useState<
    "all" | "specific"
  >("all")

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("All")

  const [loading, setLoading] = useState(false)
  const [updatingPartnerId, setUpdatingPartnerId] = useState<string | null>(null)

  const canChangePartnerStatus = user?.role === "superadmin"

  const updatePartnerStatus = async (
    partner: Partner,
    status: PartnerStatus
  ) => {
    if (!canChangePartnerStatus || partner.status === status) return

    setUpdatingPartnerId(partner.id)

    try {
      await updateDoc(doc(db, "customer", partner.id), {
        partner_status: status,
      })

      toast({
        title: "Partner status updated",
        description: `${partner.display_name} is now ${formatStatus(status)}.`,
      })
    } catch (error) {
      console.error("Failed to update partner status:", error)
      toast({
        title: "Could not update status",
        description:
          error instanceof Error
            ? error.message
            : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setUpdatingPartnerId(null)
    }
  }

  /* ==========================================================
     DATE RANGE
  ========================================================== */

  const startDate = new Date(fromDate)

  const endDate = new Date(toDate)

  endDate.setHours(
    23,
    59,
    59,
    999
  )

  /* ==========================================================
     REALTIME LISTENER
  ========================================================== */

  useEffect(() => {
    setLoading(true)

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

    const rebuildPartners = async () => {
      const allDocs = [
        ...providers,
        ...agencies,
      ]

      /* -------------------------------------------------------
         COLLECT SERVICE IDS
      ------------------------------------------------------- */

      const serviceIds = Array.from(
        new Set(
          allDocs
            .map(
              (doc) =>
                doc.data()?.partner_serviceOpt
            )
            .filter(Boolean)
        )
      ) as string[]

      /* -------------------------------------------------------
         FETCH SERVICE NAMES
      ------------------------------------------------------- */

      const newServiceMap: Record<
        string,
        string
      > = {}

      const chunks =
        chunkArray(serviceIds)

      await Promise.all(
        chunks.map(
          async (ids) => {
            if (
              ids.length === 0
            ) {
              return
            }

            const snap =
              await getDocs(
                query(
                  collection(
                    db,
                    "service_subcategories"
                  ),
                  where(
                    "__name__",
                    "in",
                    ids
                  )
                )
              )

            snap.forEach(
              (doc) => {
                newServiceMap[
                  doc.id
                ] =
                  (doc.data() as any)
                    ?.name
              }
            )
          }
        )
      )

      setServiceMap(
        newServiceMap
      )

      /* -------------------------------------------------------
         BUILD PARTNERS
      ------------------------------------------------------- */

      const data: Partner[] =
        allDocs.map(
          (docSnap) => {
            const d =
              docSnap.data()

            return {
              id:
                docSnap.id,

              display_name:
                d.display_name ||
                "Unknown",

              phone_number:
                d.phone_number ||
                "N/A",

              type:
                d.userType
                  ?.AgencyPartner
                  ? "agency"
                  : "provider",

              joinDate:
                d.created_time instanceof
                Timestamp
                  ? d.created_time
                      .toDate()
                      .toISOString()
                  : new Date(
                      0
                    ).toISOString(),

              status:
                d.partner_status ||
                "Information_Unverified",

              partner_serviceOpt:
                d.partner_serviceOpt ||
                null,

              serviceOptName:
                d.partner_serviceOpt
                  ? newServiceMap[
                      d
                        .partner_serviceOpt
                    ] ||
                    "Unknown"
                  : null,
            }
          }
        )

      data.sort(
        (a, b) =>
          new Date(
            b.joinDate
          ).getTime() -
          new Date(
            a.joinDate
          ).getTime()
      )

      setPartners(data)

      setLoading(false)
    }

    const unsubProvider =
      onSnapshot(
        providerQuery,
        (snap) => {
          providers =
            snap.docs

          rebuildPartners()
        }
      )

    const unsubAgency =
      onSnapshot(
        agencyQuery,
        (snap) => {
          agencies =
            snap.docs

          rebuildPartners()
        }
      )

    return () => {
      unsubProvider()
      unsubAgency()
    }
  }, [db])

  /* ==========================================================
     FILTERING
  ========================================================== */

  const filteredPartners =
    useMemo(() => {
      return partners.filter(
        (partner) => {
          const joined =
            new Date(
              partner.joinDate
            )

          const matchesDate =
            joined >=
              startDate &&
            joined <=
              endDate

          const matchesSearch =
            partner.display_name
              .toLowerCase()
              .includes(
                searchTerm.toLowerCase()
              ) ||
            partner.phone_number.includes(
              searchTerm
            ) ||
            partner.serviceOptName
              ?.toLowerCase()
              .includes(
                searchTerm.toLowerCase()
              )

          const matchesType =
            typeFilter ===
              "all" ||
            (typeFilter ===
              "provider" &&
              partner.type ===
                "provider") ||
            (typeFilter ===
              "agency" &&
              partner.type ===
                "agency")

          const matchesPartnerIds =
            partnerIdFilter ===
              "all" ||
            partner.status === ONBOARDED_PARTNER_STATUS

          const matchesStatus =
            statusFilter ===
              "All" ||
            partner.status ===
              statusFilter

          return (
            matchesDate &&
            matchesSearch &&
            matchesType &&
            matchesPartnerIds &&
            matchesStatus
          )
        }
      )
    }, [
      partners,
      searchTerm,
      typeFilter,
      partnerIdFilter,
      statusFilter,
      fromDate,
      toDate,
    ])

  /* ==========================================================
     ACTIVE FILTER
  ========================================================== */

  const hasActiveFilters =
    searchTerm !== "" ||
    typeFilter !== "all" ||
    partnerIdFilter !== "all" ||
    statusFilter !== "All"

  const resetFilters = () => {
    setSearchTerm("")
    setTypeFilter("all")
    setPartnerIdFilter("all")
    setStatusFilter("All")
  }

  /* ==========================================================
     EXPORT
  ========================================================== */

  const exportCSV = () => {
    const headers = [
      "Partner ID",
      "Name",
      "Phone",
      "Type",
      "Service Opt",
      "Join Date",
      "Status",
    ]

    const rows =
      filteredPartners.map(
        (partner) => [
          partner.id,
          partner.display_name,
          partner.phone_number,
          partner.type,
          partner.serviceOptName ||
            "N/A",
          new Date(
            partner.joinDate
          ).toLocaleDateString(
            "en-IN"
          ),
          partner.status,
        ]
      )

    const csv = [
      headers,
      ...rows,
    ]
      .map((row) =>
        row
          .map(
            (value) =>
              `"${value}"`
          )
          .join(",")
      )
      .join("\n")

    const blob =
      new Blob(
        [csv],
        {
          type: "text/csv",
        }
      )

    const url =
      URL.createObjectURL(
        blob
      )

    const anchor =
      document.createElement(
        "a"
      )

    anchor.href = url

    anchor.download =
      `partners_${fromDate}_to_${toDate}.csv`

    anchor.click()

    URL.revokeObjectURL(
      url
    )
  }

  /* ==========================================================
     UI
  ========================================================== */

  return (
    <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <CardHeader className="border-b border-slate-100 bg-white px-5 py-5">

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

          {/* TITLE */}

          <div className="flex items-start gap-3">

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50">

              <Users className="h-5 w-5 text-indigo-600" />

            </div>

            <div>

              <CardTitle className="text-lg font-bold text-slate-800">
                Partner Management
              </CardTitle>

              <CardDescription className="mt-1 flex items-center gap-2 text-xs text-slate-500">

                <span>
                  Showing{" "}
                  <span className="font-semibold text-slate-700">
                    {
                      filteredPartners.length
                    }
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-slate-700">
                    {
                      partners.length
                    }
                  </span>{" "}
                  partners
                </span>

                {loading && (

                  <span className="flex items-center gap-1 text-indigo-600">

                    <Loader2 className="h-3 w-3 animate-spin" />

                    Updating

                  </span>

                )}

              </CardDescription>

            </div>

          </div>

          {/* EXPORT */}

          <Button
            variant="outline"
            onClick={
              exportCSV
            }
            disabled={
              filteredPartners.length ===
              0
            }
            className="h-10 rounded-xl border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
          >

            <Download className="mr-2 h-4 w-4" />

            Export CSV

          </Button>

        </div>

        {/* ====================================================
            SEARCH + FILTERS
        ==================================================== */}

        <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center">

          {/* SEARCH */}

          <div className="relative min-w-0 flex-1">

            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <Input
              placeholder="Search by partner name, phone or service..."
              value={
                searchTerm
              }
              onChange={(e) =>
                setSearchTerm(
                  e.target.value
                )
              }
              className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-10 text-xs text-slate-700 shadow-none transition focus-visible:border-indigo-400 focus-visible:bg-white focus-visible:ring-indigo-100"
            />

          </div>

          {/* FILTER GROUP */}

          <div className="flex flex-wrap items-center gap-2">

            <div className="mr-1 hidden items-center gap-1.5 text-[11px] font-medium text-slate-400 sm:flex">

              <SlidersHorizontal className="h-3.5 w-3.5" />

              Filters

            </div>

            {/* TYPE */}

            <DropdownMenu>

              <DropdownMenuTrigger asChild>

                <Button
                  variant="outline"
                  className="h-10 rounded-xl border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 shadow-none"
                >

                  {typeFilter ===
                  "all"
                    ? "All Types"
                    : typeFilter ===
                        "provider"
                      ? "Provider"
                      : "Agency"}

                  <ChevronDown className="ml-2 h-3.5 w-3.5 text-slate-400" />

                </Button>

              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                className="min-w-[150px]"
              >

                <DropdownMenuItem
                  onClick={() =>
                    setTypeFilter(
                      "all"
                    )
                  }
                >
                  All Types
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() =>
                    setTypeFilter(
                      "provider"
                    )
                  }
                >
                  Provider
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() =>
                    setTypeFilter(
                      "agency"
                    )
                  }
                >
                  Agency
                </DropdownMenuItem>

              </DropdownMenuContent>

            </DropdownMenu>

            {/* PARTNER IDS */}

            <DropdownMenu>

              <DropdownMenuTrigger asChild>

                <Button
                  variant="outline"
                  className="h-10 rounded-xl border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 shadow-none"
                >

                  {partnerIdFilter ===
                  "all"
                    ? "All Partners"
                    : "Specific IDs"}

                  <ChevronDown className="ml-2 h-3.5 w-3.5 text-slate-400" />

                </Button>

              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
              >

                <DropdownMenuItem
                  onClick={() =>
                    setPartnerIdFilter(
                      "all"
                    )
                  }
                >
                  All Partners
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() =>
                    setPartnerIdFilter(
                      "specific"
                    )
                  }
                >
                  Specific IDs
                </DropdownMenuItem>

              </DropdownMenuContent>

            </DropdownMenu>

            {/* STATUS */}

            <DropdownMenu>

              <DropdownMenuTrigger asChild>

                <Button
                  variant="outline"
                  className="h-10 rounded-xl border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 shadow-none"
                >

                  {statusFilter ===
                  "All"
                    ? "All Status"
                    : formatStatus(
                        statusFilter
                      )}

                  <ChevronDown className="ml-2 h-3.5 w-3.5 text-slate-400" />

                </Button>

              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                className="min-w-[210px]"
              >

                {STATUS_OPTIONS.map(
                  (status) => (

                    <DropdownMenuItem
                      key={
                        status
                      }
                      onClick={() =>
                        setStatusFilter(
                          status
                        )
                      }
                    >

                      {status ===
                      "All"
                        ? "All Status"
                        : formatStatus(
                            status
                          )}

                    </DropdownMenuItem>

                  )
                )}

              </DropdownMenuContent>

            </DropdownMenu>

            {/* RESET */}

            {hasActiveFilters && (

              <Button
                variant="ghost"
                onClick={
                  resetFilters
                }
                className="h-10 rounded-xl px-3 text-xs font-medium text-slate-500 hover:bg-slate-100"
              >

                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />

                Reset

              </Button>

            )}

          </div>

        </div>

      </CardHeader>

      {/* ======================================================
          TABLE
      ====================================================== */}

      <CardContent className="p-0">

        <div className="overflow-x-auto">

          <Table exportable={false}>

            {/* =================================================
                TABLE HEADER
            ================================================= */}

            <TableHeader>

              <TableRow className="border-b border-slate-200 bg-slate-50/80 hover:bg-slate-50/80">

                <TableHead className="h-12 min-w-[250px] px-5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Partner
                </TableHead>

                <TableHead className="h-12 min-w-[120px] text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Type
                </TableHead>

                <TableHead className="h-12 min-w-[150px] text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Contact
                </TableHead>

                <TableHead className="h-12 min-w-[170px] text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Service
                </TableHead>

                <TableHead className="h-12 min-w-[135px] text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Join Date
                </TableHead>

                <TableHead className="h-12 min-w-[190px] text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </TableHead>

                <TableHead className="h-12 w-[80px] text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Action
                </TableHead>

              </TableRow>

            </TableHeader>

            {/* =================================================
                TABLE BODY
            ================================================= */}

            <TableBody>

              {filteredPartners.map(
                (partner) => {

                  const isOnboarded =
                    partner.status ===
                    "Onboarded"

                  const isUnverified =
                    partner.status ===
                    "Information_Unverified"

                  return (

                    <TableRow
                      key={
                        partner.id
                      }
                      className="group border-b border-slate-100 transition-colors hover:bg-slate-50/70"
                    >

                      {/* =========================================
                          PARTNER
                      ========================================= */}

                      <TableCell className="px-5 py-4">

                        <div className="flex items-center gap-3">

                          {/* AVATAR */}

                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 text-xs font-bold text-indigo-700 ring-1 ring-indigo-100">

                            {getInitials(
                              partner.display_name
                            )}

                          </div>

                          {/* INFO */}

                          <div className="min-w-0">

                            <p className="truncate text-sm font-semibold text-slate-800">

                              {
                                partner.display_name
                              }

                            </p>

                            <p
                              title={
                                partner.id
                              }
                              className="mt-1 max-w-[180px] truncate text-[10px] font-medium text-slate-400"
                            >

                              ID:{" "}
                              {
                                partner.id
                              }

                            </p>

                          </div>

                        </div>

                      </TableCell>

                      {/* =========================================
                          TYPE
                      ========================================= */}

                      <TableCell>

                        {partner.type ===
                        "agency" ? (

                          <div className="inline-flex items-center gap-1.5 rounded-lg border border-violet-100 bg-violet-50 px-2.5 py-1.5">

                            <Building2 className="h-3.5 w-3.5 text-violet-600" />

                            <span className="text-[10px] font-semibold text-violet-700">
                              Agency
                            </span>

                          </div>

                        ) : (

                          <div className="inline-flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5">

                            <User className="h-3.5 w-3.5 text-blue-600" />

                            <span className="text-[10px] font-semibold text-blue-700">
                              Provider
                            </span>

                          </div>

                        )}

                      </TableCell>

                      {/* =========================================
                          CONTACT
                      ========================================= */}

                      <TableCell>

                        <div className="flex items-center gap-2">

                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50">

                            <Phone className="h-3.5 w-3.5 text-slate-400" />

                          </div>

                          <span className="text-xs font-medium text-slate-600">

                            {
                              partner.phone_number
                            }

                          </span>

                        </div>

                      </TableCell>

                      {/* =========================================
                          SERVICE
                      ========================================= */}

                      <TableCell>

                        {partner.serviceOptName ? (

                          <div className="inline-flex max-w-[160px] items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1.5">

                            <Briefcase className="h-3.5 w-3.5 shrink-0 text-indigo-600" />

                            <span className="truncate text-[10px] font-semibold text-indigo-700">

                              {
                                partner.serviceOptName
                              }

                            </span>

                          </div>

                        ) : (

                          <span className="text-xs text-slate-400">
                            Not assigned
                          </span>

                        )}

                      </TableCell>

                      {/* =========================================
                          JOIN DATE
                      ========================================= */}

                      <TableCell>

                        <div className="flex items-center gap-2">

                          <CalendarDays className="h-3.5 w-3.5 text-slate-400" />

                          <span className="text-xs font-medium text-slate-600">

                            {new Date(
                              partner.joinDate
                            ).toLocaleDateString(
                              "en-IN",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              }
                            )}

                          </span>

                        </div>

                      </TableCell>

                      {/* =========================================
                          STATUS
                      ========================================= */}

                      <TableCell>
                        {canChangePartnerStatus ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                disabled={updatingPartnerId === partner.id}
                                title="Change partner status"
                                className={
                                  isOnboarded
                                    ? "h-8 rounded-full border-emerald-200 bg-emerald-50 px-2.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100"
                                    : isUnverified
                                      ? "h-8 rounded-full border-rose-200 bg-rose-50 px-2.5 text-[10px] font-semibold text-rose-600 hover:bg-rose-100"
                                      : "h-8 rounded-full border-amber-200 bg-amber-50 px-2.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-100"
                                }
                              >
                                {updatingPartnerId === partner.id ? (
                                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                ) : (
                                  <span
                                    className={
                                      isOnboarded
                                        ? "mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500"
                                        : isUnverified
                                          ? "mr-1.5 h-1.5 w-1.5 rounded-full bg-rose-500"
                                          : "mr-1.5 h-1.5 w-1.5 rounded-full bg-amber-500"
                                    }
                                  />
                                )}
                                {formatStatus(partner.status)}
                                <ChevronDown className="ml-1.5 h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="min-w-[210px]">
                              {STATUS_OPTIONS.filter(
                                (status): status is PartnerStatus => status !== "All"
                              ).map((status) => (
                                <DropdownMenuItem
                                  key={status}
                                  disabled={partner.status === status}
                                  onClick={() => updatePartnerStatus(partner, status)}
                                >
                                  {formatStatus(status)}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <Badge
                            variant="outline"
                            className={
                              isOnboarded
                                ? "rounded-full border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700"
                                : isUnverified
                                  ? "rounded-full border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-semibold text-rose-600"
                                  : "rounded-full border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700"
                            }
                          >
                            <span
                              className={
                                isOnboarded
                                  ? "mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500"
                                  : isUnverified
                                    ? "mr-1.5 h-1.5 w-1.5 rounded-full bg-rose-500"
                                    : "mr-1.5 h-1.5 w-1.5 rounded-full bg-amber-500"
                              }
                            />
                            {formatStatus(partner.status)}
                          </Badge>
                        )}

                      </TableCell>

                      {/* =========================================
                          ACTION
                      ========================================= */}

                      <TableCell className="text-center">

                        <Link
                          href={`/partners/${partner.id}`}
                        >

                          <Button
                            size="icon"
                            variant="ghost"
                            title="View partner details"
                            className="h-9 w-9 rounded-xl text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600"
                          >

                            <Eye className="h-4 w-4" />

                          </Button>

                        </Link>

                      </TableCell>

                    </TableRow>

                  )
                }
              )}

            </TableBody>

          </Table>

        </div>

        {/* ====================================================
            EMPTY STATE
        ==================================================== */}

        {!loading &&
          filteredPartners.length ===
            0 && (

            <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">

                <Search className="h-6 w-6 text-slate-400" />

              </div>

              <p className="mt-4 text-sm font-semibold text-slate-700">
                No partners found
              </p>

              <p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">
                No partner matches the selected date range, search or filters.
              </p>

              {hasActiveFilters && (

                <Button
                  variant="outline"
                  onClick={
                    resetFilters
                  }
                  className="mt-4 h-9 rounded-xl text-xs"
                >

                  <RotateCcw className="mr-2 h-3.5 w-3.5" />

                  Clear Filters

                </Button>

              )}

            </div>

          )}

        {/* ====================================================
            LOADING EMPTY STATE
        ==================================================== */}

        {loading &&
          partners.length ===
            0 && (

            <div className="flex min-h-[280px] flex-col items-center justify-center">

              <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />

              <p className="mt-3 text-xs font-medium text-slate-500">
                Loading partners...
              </p>

            </div>

          )}

        {/* ====================================================
            TABLE FOOTER
        ==================================================== */}

        {filteredPartners.length >
          0 && (

          <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">

            <p className="text-[11px] text-slate-500">

              Showing{" "}

              <span className="font-semibold text-slate-700">
                {
                  filteredPartners.length
                }
              </span>{" "}

              partner
              {filteredPartners.length !==
              1
                ? "s"
                : ""}

            </p>

            <p className="text-[10px] text-slate-400">
              Realtime partner data
            </p>

          </div>

        )}

      </CardContent>

    </Card>
  )
}
