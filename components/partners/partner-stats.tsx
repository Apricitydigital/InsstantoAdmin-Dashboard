"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, UserCheck, Clock, DollarSign, AlertTriangle } from "lucide-react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"

type Partner = {
  id: string
  type: "provider" | "agency"
  status: "active" | "pending" | "suspended" | "rejected"
  kycStatus: "verified" | "pending" | "rejected"
  earnings: number
  pendingPayouts: number
}

export function PartnerStats() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const db = getFirestoreDb()

        // Fetch onboarded providers & agencies
        const q1 = query(
          collection(db, "customer"),
          where("userType.provider", "==", true),
          where("partner_status", "==", "Onboarded")
        )
        const q2 = query(
          collection(db, "customer"),
          where("userType.AgencyPartner", "==", true),
          where("partner_status", "==", "Onboarded")
        )

        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)])

        // Fetch Wallet data
        const walletSnap = await getDocs(collection(db, "Wallet_Overall"))
        const walletMap: Record<string, any> = {}
        walletSnap.forEach((docSnap) => {
          const d = docSnap.data()
          if (d.service_partner_id?.id) {
            walletMap[d.service_partner_id.id] = {
              earnings: d.TotalAmountComeIn_Wallet || 0,
              pendingPayouts: d.total_balance || 0,
            }
          }
        })

        const partnersData: Partner[] = []
        const pushPartner = (docSnap: any, type: "provider" | "agency") => {
          const d = docSnap.data()
          const wallet = walletMap[docSnap.id] || { earnings: 0, pendingPayouts: 0 }

          partnersData.push({
            id: docSnap.id,
            type,
            status: d.partner_status || "pending",
            kycStatus: d.kyc_status || "pending",
            earnings: wallet.earnings,
            pendingPayouts: wallet.pendingPayouts,
          })
        }

        snap1.docs.forEach((doc) => pushPartner(doc, "provider"))
        snap2.docs.forEach((doc) => pushPartner(doc, "agency"))

        // Filter only allowed partner IDs
        const allowedIds = [
          "mwBcGMWLwDULHIS9hXx7JLuRfCi1",
          "Dmoo33tCx0OU1HMtapISBc9Oeeq2",
          "VxxapfO7l8YM5f6xmFqpThc17eD3",
          "Q0kKYbdOKVbeZsdiLGsJoM5BWQl1",
          "7KlujhUyJbeCTPG6Pty8exlxXuM2",
          "fGLJCCFDEneQZ7ciz71Q29WBgGQ2",
          "MstGdrDCHkZ1KKf0xtZctauIovf2",

        ]
        setPartners(partnersData.filter((p) => allowedIds.includes(p.id)))
      } catch (error) {
        console.error("Error fetching partner stats:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchPartners()
  }, [])

  if (loading) return <div>Loading stats...</div>

  // === Aggregate Stats ===
  const totalPartners = partners.filter((p) => p.type === "provider").length
  const totalAgency = partners.filter((p) => p.type === "agency").length
  const pendingVerification = partners.filter((p) => p.kycStatus === "pending").length
  const totalEarnings = partners.reduce((sum, p) => sum + p.earnings, 0)
  const pendingPayouts = partners.reduce((sum, p) => sum + p.pendingPayouts, 0)

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount)

  const stats = [
    {
      title: "Total Partners",
      value: totalPartners.toString(),
      icon: Users,
      border: "border-blue-600",
      bg: "bg-blue-50",
      text: "text-blue-700",
      description: "All registered partners",
    },
    {
      title: "Total Agency",
      value: totalAgency.toString(),
      icon: UserCheck,
      border: "border-green-600",
      bg: "bg-green-50",
      text: "text-green-700",
      description: "Agency partners onboarded",
    },
    {
      title: "Pending Verification",
      value: pendingVerification.toString(),
      icon: Clock,
      border: "border-yellow-600",
      bg: "bg-yellow-50",
      text: "text-yellow-700",
      description: "Awaiting KYC approval",
    },
    {
      title: "Total Earnings",
      value: formatCurrency(totalEarnings),
      icon: DollarSign,
      border: "border-purple-600",
      bg: "bg-purple-50",
      text: "text-purple-700",
      description: "Partner earnings to date",
    },
    {
      title: "Pending Payouts",
      value: formatCurrency(pendingPayouts),
      icon: AlertTriangle,
      border: "border-orange-600",
      bg: "bg-orange-50",
      text: "text-orange-700",
      description: "Awaiting payment",
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-6">
      {stats.map((stat, idx) => (
        <Card
          key={`${stat.title}-${idx}`}
          className={`border-l-4 ${stat.border} ${stat.bg} shadow-sm hover:shadow-md transition-transform hover:scale-[1.02]`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={`text-sm font-medium ${stat.text}`}>{stat.title}</CardTitle>
            <stat.icon className={`h-5 w-5 ${stat.text}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stat.text}`}>{stat.value}</div>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}