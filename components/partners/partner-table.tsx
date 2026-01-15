"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"

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
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"

import { Search, Eye, Download } from "lucide-react"

/* ------------------------------------------------------------------ */
/* CONSTANTS */
/* ------------------------------------------------------------------ */

const ALLOWED_PARTNER_IDS = [
  "mwBcGMWLwDULHIS9hXx7JLuRfCi1",
  "Dmoo33tCx0OU1HMtapISBc9Oeeq2",
  "VxxapfO7l8YM5f6xmFqpThc17eD3",
  "Q0kKYbdOKVbeZsdiLGsJoM5BWQl1",
  "7KlujhUyJbeCTPG6Pty8exlxXuM2",
  "fGLJCCFDEneQZ7ciz71Q29WBgGQ2",
  "MstGdrDCHkZ1KKf0xtZctauIovf2",
  "OgioZJvg0DWWRnqZLj2AUMUljZN2",
  "B1FsSfpqRIPS6Sg0fn3QetCOyAw2",
  "uSZdJdat03froahSdGmPpFWDGhi2",
]

const STATUS_OPTIONS = [
  "All",
  "DocumentsUploaded",
  "Onboarded",
  "Information_Verified",
  "Id_Generated",
  "RegistrationFormFilled",
  "Information_Unverified",
] as const

type StatusFilter = typeof STATUS_OPTIONS[number]

/* ------------------------------------------------------------------ */
/* TYPES */
/* ------------------------------------------------------------------ */

type Partner = {
  id: string
  display_name: string
  phone_number: string
  type: "provider" | "agency"
  joinDate: string
  status: string
  serviceOptName: string | null
}

interface PartnerTableProps {
  fromDate: string
  toDate: string
}

/* ------------------------------------------------------------------ */
/* UTILS */
/* ------------------------------------------------------------------ */

const chunkArray = <T,>(arr: T[], size = 10) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  )

/* ------------------------------------------------------------------ */
/* COMPONENT */
/* ------------------------------------------------------------------ */

export function PartnerTable({ fromDate, toDate }: PartnerTableProps) {
  const [partners, setPartners] = useState<Partner[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] =
    useState<"all" | "provider" | "agency">("all")
  const [partnerIdFilter, setPartnerIdFilter] =
    useState<"all" | "specific">("all")
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("All")

  /* ---------------- FETCH ---------------- */

  useEffect(() => {
    const fetchPartners = async () => {
      const db = getFirestoreDb()

      const providerQuery = query(
        collection(db, "customer"),
        where("userType.provider", "==", true)
      )

      const agencyQuery = query(
        collection(db, "customer"),
        where("userType.AgencyPartner", "==", true)
      )

      const [providerSnap, agencySnap] = await Promise.all([
        getDocs(providerQuery),
        getDocs(agencyQuery),
      ])

      const allDocs = [...providerSnap.docs, ...agencySnap.docs]

      /* ---- collect service_subcategory ids ---- */
      const serviceIds = Array.from(
        new Set(
          allDocs
            .map((d) => d.data().partner_serviceOpt)
            .filter(Boolean)
        )
      )

      /* ---- fetch service_subcategories ---- */
      const serviceMap: Record<string, string> = {}
      const chunks = chunkArray(serviceIds)

      await Promise.all(
        chunks.map(async (ids) => {
          const snap = await getDocs(
            query(
              collection(db, "service_subcategories"),
              where("__name__", "in", ids)
            )
          )
          snap.forEach((doc) => {
            serviceMap[doc.id] = doc.data().name
          })
        })
      )

      const data: Partner[] = allDocs.map((doc) => {
        const d = doc.data()
        return {
          id: doc.id,
          display_name: d.display_name || "Unknown",
          phone_number: d.phone_number || "N/A",
          type: d.userType?.AgencyPartner ? "agency" : "provider",
          joinDate:
            d.created_time instanceof Timestamp
              ? d.created_time.toDate().toISOString()
              : new Date(0).toISOString(),
          status: d.partner_status || "Information_Unverified",
          serviceOptName: d.partner_serviceOpt
            ? serviceMap[d.partner_serviceOpt] || "Unknown"
            : null,
        }
      })

      data.sort(
        (a, b) =>
          new Date(b.joinDate).getTime() -
          new Date(a.joinDate).getTime()
      )

      setPartners(data)
    }

    fetchPartners()
  }, [])

  /* ---------------- DATE RANGE ---------------- */

  const startDate = new Date(fromDate)
  const endDate = new Date(toDate)
  endDate.setHours(23, 59, 59, 999)

  /* ---------------- FILTERING ---------------- */

  const filteredPartners = useMemo(() => {
    return partners.filter((p) => {
      const joined = new Date(p.joinDate)

      const matchesDate =
        joined >= startDate && joined <= endDate

      const matchesSearch =
        p.display_name
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        p.phone_number.includes(searchTerm) ||
        p.serviceOptName?.toLowerCase().includes(searchTerm.toLowerCase() )

      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "provider" && p.type === "provider") ||
        (typeFilter === "agency" && p.type === "agency")

      const matchesPartnerIds =
        partnerIdFilter === "all" ||
        ALLOWED_PARTNER_IDS.includes(p.id)

      const matchesStatus =
        statusFilter === "All" || p.status === statusFilter

      return (
        matchesDate &&
        matchesSearch &&
        matchesType &&
        matchesPartnerIds &&
        matchesStatus
      )
    })
  }, [
    partners,
    searchTerm,
    typeFilter,
    partnerIdFilter,
    statusFilter,
    fromDate,
    toDate,
  ])

  /* ---------------- EXPORT ---------------- */

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

    const rows = filteredPartners.map((p) => [
      p.id,
      p.display_name,
      p.phone_number,
      p.type,
      p.serviceOptName || "N/A",
      new Date(p.joinDate).toLocaleDateString("en-IN"),
      p.status,
    ])

    const csv =
      [headers, ...rows]
        .map((row) => row.map((v) => `"${v}"`).join(","))
        .join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = url
    a.download = `partners_${fromDate}_to_${toDate}.csv`
    a.click()

    URL.revokeObjectURL(url)
  }

  /* ---------------- UI ---------------- */

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Partner Management</CardTitle>
            <CardDescription>
              Showing {filteredPartners.length} partners
            </CardDescription>
          </div>

          <Button variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        <div className="flex flex-wrap gap-3 pt-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search partner..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* TYPE */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Type: {typeFilter}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setTypeFilter("all")}>All</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTypeFilter("provider")}>Provider</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTypeFilter("agency")}>Agency</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* PARTNER IDS */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Partner IDs: {partnerIdFilter === "all" ? "All" : "Specific"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setPartnerIdFilter("all")}>
                All
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPartnerIdFilter("specific")}>
                Specific
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* STATUS */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Status: {statusFilter}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {STATUS_OPTIONS.map((s) => (
                <DropdownMenuItem
                  key={s}
                  onClick={() => setStatusFilter(s)}
                >
                  {s}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Service Opt</TableHead>
                <TableHead>Join Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredPartners.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.display_name}</div>
                    <div className="text-xs text-muted-foreground">{p.id}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{p.type}</Badge>
                  </TableCell>
                  <TableCell>{p.phone_number}</TableCell>
                  <TableCell>
                    {p.serviceOptName ? (
                      <Badge variant="outline">{p.serviceOptName}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(p.joinDate).toLocaleDateString("en-IN")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{p.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={`/partners/${p.id}`}>
                      <Button size="icon" variant="ghost">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredPartners.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">
            No partners found
          </div>
        )}
      </CardContent>
    </Card>
  )
}
