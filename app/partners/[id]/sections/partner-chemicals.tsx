"use client"

import React, { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertCircle, CheckCircle, FileText } from "lucide-react"
import { collection, query, where, getDocs, Timestamp, DocumentReference, doc } from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"

interface PartnerChemicalsSectionProps {
    partnerId: string
}

interface ChemicalPurchase {
    id: string
    purchase_date: Date
    amount_paid: number
    status: string
    chemicalname: string[]
    chemicalquantity: number[]
    PaymentType?: string
}

export function PartnerChemicalsSection({ partnerId }: PartnerChemicalsSectionProps) {
    const [loading, setLoading] = useState(true)
    const [purchases, setPurchases] = useState<ChemicalPurchase[]>([])

    useEffect(() => {
        const fetchData = async () => {
            try {
                const db = getFirestoreDb()
                const q = query(
                    collection(db, "chemical_purchase_record"),
                    where("partnerId", "==", doc(db, `customer/${partnerId}`) as DocumentReference)
                )


                const snapshot = await getDocs(q)
                const data: ChemicalPurchase[] = snapshot.docs.map(doc => {
                    const d = doc.data()
                    return {
                        id: doc.id,
                        purchase_date: d.purchase_date?.toDate?.() || new Date(),
                        amount_paid: d.amount_paid || 0,
                        status: d.status || "pending",
                        chemicalname: d.chemicalname || [],
                        chemicalquantity: d.chemicalquantity || [],
                        PaymentType: d.PaymentType || ""
                    }
                })
                setPurchases(data)
            } catch (error) {
                console.error("Error fetching chemical purchases:", error)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [partnerId])

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount)

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "delivered":
                return <Badge className="bg-green-100 text-green-800">Delivered</Badge>
            case "pending":
                return <Badge variant="outline">Pending</Badge>
            case "cancelled":
                return <Badge variant="destructive">Cancelled</Badge>
            default:
                return <Badge variant="secondary">{status}</Badge>
        }
    }

    const totalSpent = purchases.reduce((sum, p) => sum + p.amount_paid, 0)
    const totalOrders = purchases.length
    const deliveredOrders = purchases.filter(p => p.status === "received").length

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <AlertCircle className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">Total Spent</p>
                                <p className="text-2xl font-bold">{formatCurrency(totalSpent)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">Total Orders</p>
                                <p className="text-2xl font-bold">{totalOrders}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <FileText className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">Delivered</p>
                                <p className="text-2xl font-bold">{deliveredOrders}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Chemical Purchase History</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8">Loading...</div>
                    ) : purchases.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>No chemical purchases found.</p>
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>ID</TableHead>
                                        <TableHead>Chemicals</TableHead>
                                        <TableHead>Amount Paid</TableHead>
                                        <TableHead>Payment Type</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {purchases.map(p => (
                                        <TableRow key={p.id}>
                                            <TableCell>
                                                {p.id}
                                            </TableCell>
                                            <TableCell>
                                                {p.chemicalname.map((name, idx) => (
                                                    <div key={idx} className="text-sm">{name}</div>
                                                ))}
                                            </TableCell>

                                            <TableCell className="font-medium">{formatCurrency(p.amount_paid)}</TableCell>
                                            <TableCell>{p.PaymentType || "UPI"}</TableCell>
                                            <TableCell>{p.purchase_date.toLocaleDateString()}</TableCell>
                                            <TableCell>{getStatusBadge(p.status)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
