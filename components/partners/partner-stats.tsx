"use client"

import { useEffect, useMemo, useState } from "react"
import {
  collection,
  onSnapshot,
  query,
  where,
  Timestamp,
} from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type Partner = {
  id: string
  joinDate: Date
  status: string
}

interface PartnerStatsProps {
  fromDate?: string
  toDate?: string
}

export function PartnerStats({ fromDate, toDate }: PartnerStatsProps) {
  const db = getFirestoreDb()
  const [partners, setPartners] = useState<Partner[]>([])

  /* ---------------- SAFE DATE PARSER ---------------- */

  const parseDate = (dateStr?: string) => {
    if (!dateStr) return null
    const parts = dateStr.split("/")
    if (parts.length !== 3) return null

    const [month, day, year] = parts
    return new Date(Number(year), Number(month) - 1, Number(day))
  }

const startDate = fromDate ? new Date(fromDate) : null
const endDate = toDate ? new Date(toDate) : null

if (endDate) {
  endDate.setHours(23, 59, 59, 999)
}

  /* ---------------- REALTIME FETCH ---------------- */

  useEffect(() => {
    const providerQuery = query(
      collection(db, "customer"),
      where("userType.provider", "==", true)
    )

    const agencyQuery = query(
      collection(db, "customer"),
      where("userType.AgencyPartner", "==", true)
    )

    let providers: any[] = []
    let agencies: any[] = []

    const rebuild = () => {
      const allDocs = [...providers, ...agencies]

      const data: Partner[] = allDocs.map((docSnap) => {
        const d = docSnap.data()

        return {
          id: docSnap.id,
          joinDate:
            d.created_time instanceof Timestamp
              ? d.created_time.toDate()
              : new Date(0),
          status: d.partner_status || "Information_Unverified",
        }
      })

      setPartners(data)
    }

    const unsubProvider = onSnapshot(providerQuery, (snap) => {
      providers = snap.docs
      rebuild()
    })

    const unsubAgency = onSnapshot(agencyQuery, (snap) => {
      agencies = snap.docs
      rebuild()
    })

    return () => {
      unsubProvider()
      unsubAgency()
    }
  }, [db])

  /* ---------------- DATE FILTER ONLY ---------------- */

const dateFilteredPartners = useMemo(() => {
  if (!startDate || !endDate) return partners

  return partners.filter((p) => {
    const joined = new Date(p.joinDate)

    return joined >= startDate && joined <= endDate
  })
}, [partners, fromDate, toDate])

  /* ---------------- STATS ---------------- */

  const totalPartners = dateFilteredPartners.length

  const onboardedPartners = dateFilteredPartners.filter(
    (p) => p.status === "Onboarded"
  ).length

  const unverifiedPartners = dateFilteredPartners.filter(
    (p) => p.status === "Information_Unverified"
  ).length

  const otherStatusPartners = dateFilteredPartners.filter(
    (p) =>
      p.status !== "Onboarded" &&
      p.status !== "Information_Unverified"
  ).length

  /* ---------------- UI ---------------- */

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle>Total Partners</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{totalPartners}</div>
          <p className="text-xs text-muted-foreground">
            Based on selected date range
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Onboarded</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600">
            {onboardedPartners}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Unverified</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-red-600">
            {unverifiedPartners}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Other Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-blue-600">
            {otherStatusPartners}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}