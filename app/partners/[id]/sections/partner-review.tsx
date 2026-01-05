"use client"

import React, { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    collection,
    doc,
    getDocs,
    getDoc,
    query,
    where,
    Timestamp,
    DocumentReference,
} from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"
import {
    Star,
    Loader2,
    MessageSquare,
} from "lucide-react"

type Review = {
    id: string
    rating: number
    feedback?: string
    reasonOptions: string[]
    review_date?: Timestamp
    customerName?: string
    customerPhone?: string
}

interface PartnerReviewsSectionProps {
    partnerId: string
}

export function PartnerReviewsSection({ partnerId }: PartnerReviewsSectionProps) {
    const db = getFirestoreDb()
    const [reviews, setReviews] = useState<Review[]>([])
    const [loading, setLoading] = useState(true)

    // Pagination
    const [currentPage, setCurrentPage] = useState(1)
    const rowsPerPage = 5
    const positiveReviews = reviews.filter(r => r.rating >= 4).length
    const negativeReviews = reviews.filter(r => r.rating <= 2).length

    const totalConsidered = positiveReviews + negativeReviews
    const positivePercent =
        totalConsidered > 0 ? ((positiveReviews / totalConsidered) * 100).toFixed(1) : "0"
    const negativePercent =
        totalConsidered > 0 ? ((negativeReviews / totalConsidered) * 100).toFixed(1) : "0"


    useEffect(() => {
        const fetchReviews = async () => {
            try {
                setLoading(true)

                const partnerRef = doc(db, "customer", partnerId)

                const reviewsQuery = query(
                    collection(db, "reviews"),
                    where("partnerId", "==", partnerRef)
                )
                const snap = await getDocs(reviewsQuery)

                const reviewList: Review[] = await Promise.all(
                    snap.docs.map(async (d) => {
                        const data = d.data() as any

                        // fetch customer details if available
                        let customerName = "Anonymous"
                        let customerPhone = "—"
                        if (data.customerId) {
                            try {
                                const customerSnap = await getDoc(data.customerId as DocumentReference)
                                if (customerSnap.exists()) {
                                    const cData = customerSnap.data() as any
                                    customerName = cData.display_name || cData.customer_name || "Anonymous"
                                    customerPhone = cData.phone_number || cData.contact_no || "—"
                                }
                            } catch (err) {
                                console.warn("Error fetching customer info:", err)
                            }
                        }

                        return {
                            id: d.id,
                            rating: data.partnerRating || 0,
                            feedback: data.feedback || "",
                            reasonOptions: data.partner_reasonOptions || [],
                            review_date: data.timestamp,
                            customerName,
                            customerPhone,
                        }
                    })
                )

                // ignore 0 rating reviews
                const filtered = reviewList.filter(r => r.rating > 0)

                // sort latest first
                const sorted = filtered.sort((a, b) => {
                    const dateA = a.review_date?.toDate().getTime() || 0
                    const dateB = b.review_date?.toDate().getTime() || 0
                    return dateB - dateA
                })

                setReviews(sorted)
            } catch (error) {
                console.error("Error fetching reviews:", error)
            } finally {
                setLoading(false)
            }
        }

        if (partnerId) {
            fetchReviews()
        }
    }, [partnerId, db])

    const formatDate = (timestamp?: Timestamp) => {
        if (!timestamp?.toDate) return "—"
        return timestamp.toDate().toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })
    }

    // Pagination logic
    const indexOfLast = currentPage * rowsPerPage
    const indexOfFirst = indexOfLast - rowsPerPage
    const currentRecords = reviews.slice(indexOfFirst, indexOfLast)
    const totalPages = Math.ceil(reviews.length / rowsPerPage)

    // Average rating
    const avgRating =
        reviews.length > 0
            ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
            : "0.0"

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Loading reviews...
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Overview */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="p-3 bg-yellow-100 rounded-lg">
                            <Star className="w-6 h-6 text-yellow-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Average Rating</p>
                            <p className="text-2xl font-bold">{avgRating} / 5</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Based on {reviews.length} reviews
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="p-3 bg-green-100 rounded-lg">
                            <MessageSquare className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Review Sentiment</p>
                            <div className="flex items-center gap-4 mt-1">
                                <div className="text-center">
                                    <p className="text-lg font-bold text-green-600">{positiveReviews}</p>
                                    <p className="text-xs text-muted-foreground">Positive ({positivePercent}%)</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-bold text-red-600">{negativeReviews}</p>
                                    <p className="text-xs text-muted-foreground">Negative ({negativePercent}%)</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

            </div>

            {/* Reviews List */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5" />
                        Customer Reviews
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {reviews.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>No reviews found.</p>
                        </div>
                    ) : (
                        <>
                            <div className="rounded-md border overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Customer</TableHead>
                                            <TableHead>Contact</TableHead>
                                            <TableHead>Rating</TableHead>
                                            <TableHead>Feedback</TableHead>
                                            <TableHead>Reasons</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {currentRecords.map((review) => (
                                            <TableRow key={review.id}>
                                                <TableCell className="font-mono text-sm">
                                                    {formatDate(review.review_date)}
                                                </TableCell>
                                                <TableCell>{review.customerName}</TableCell>
                                                <TableCell>{review.customerPhone}</TableCell>
                                                <TableCell>
                                                    <Badge className="bg-yellow-100 text-yellow-800">
                                                        {review.rating} ★
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{review.feedback || "—"}</TableCell>
                                                <TableCell>
                                                    {review.reasonOptions.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {review.reasonOptions.map((r, i) => (
                                                                <Badge key={i} variant="outline">{r}</Badge>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        "—"
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination Controls */}
                            <div className="flex justify-between items-center mt-4">
                                <Button
                                    variant="outline"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage((prev) => prev - 1)}
                                >
                                    Previous
                                </Button>
                                <span className="text-sm text-muted-foreground">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage((prev) => prev + 1)}
                                >
                                    Next
                                </Button>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
