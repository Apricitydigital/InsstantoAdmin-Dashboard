"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  Star,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  TrendingUp,
} from "lucide-react"
import type { Partner } from "@/types/partner"
import { mockPartners, mockPartnerPayouts } from "@/lib/queries/partners"

interface PartnerProfileProps {
  partnerId: string
}

export function PartnerProfile({ partnerId }: PartnerProfileProps) {
  const partner = mockPartners.find((p) => p.id === partnerId)
  const payouts = mockPartnerPayouts.filter((p) => p.partnerId === partnerId)

  if (!partner) {
    return (
      <div className="text-center py-8">
        <h2 className="text-2xl font-bold">Partner Not Found</h2>
        <p className="text-muted-foreground">The requested partner could not be found.</p>
      </div>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }

  const getStatusBadge = (status: Partner["status"]) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>
      case "suspended":
        return <Badge variant="destructive">Suspended</Badge>
      case "rejected":
        return <Badge variant="outline">Rejected</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getDocumentStatusIcon = (status: string) => {
    switch (status) {
      case "verified":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Partner Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xl font-bold">
                {partner.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </div>
              <div>
                <CardTitle className="text-2xl">{partner.name}</CardTitle>
                <CardDescription className="flex items-center gap-4 mt-2">
                  <span className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {partner.email}
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    {partner.phone}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {partner.city}
                  </span>
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(partner.status)}
              <Badge variant={partner.kycStatus === "verified" ? "default" : "outline"}>KYC: {partner.kycStatus}</Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Partner Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{partner.totalBookings}</div>
            <p className="text-xs text-muted-foreground">
              {partner.completedBookings} completed, {partner.cancelledBookings} cancelled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(partner.earnings)}</div>
            <p className="text-xs text-muted-foreground">Pending: {formatCurrency(partner.pendingPayouts)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1">
              {partner.rating || "N/A"}
              {partner.rating > 0 && <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />}
            </div>
            <p className="text-xs text-muted-foreground">{partner.onTimePercentage}% on-time delivery</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{partner.compliance.complianceScore}%</div>
            <Progress value={partner.compliance.complianceScore} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Partner Details Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Service Areas</CardTitle>
                <CardDescription>Areas where partner provides services</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {partner.areas.map((area) => (
                    <Badge key={area} variant="outline">
                      {area}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Services Offered</CardTitle>
                <CardDescription>Types of services provided</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {partner.services.map((service) => (
                    <Badge key={service} variant="secondary">
                      {service}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Key Metrics</CardTitle>
              <CardDescription>Partner performance indicators</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Acceptance Rate</span>
                    <span className="text-sm font-medium">{partner.acceptanceRate}%</span>
                  </div>
                  <Progress value={partner.acceptanceRate} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">On-Time Delivery</span>
                    <span className="text-sm font-medium">{partner.onTimePercentage}%</span>
                  </div>
                  <Progress value={partner.onTimePercentage} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Completion Rate</span>
                    <span className="text-sm font-medium">
                      {Math.round((partner.completedBookings / partner.totalBookings) * 100) || 0}%
                    </span>
                  </div>
                  <Progress value={(partner.completedBookings / partner.totalBookings) * 100 || 0} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="verification" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Document Verification</CardTitle>
              <CardDescription>KYC documents and verification status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {partner.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getDocumentStatusIcon(doc.status)}
                      <div>
                        <p className="font-medium">{doc.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Uploaded: {formatDate(doc.uploadDate)}
                          {doc.verifiedDate && ` • Verified: ${formatDate(doc.verifiedDate)}`}
                        </p>
                        {doc.rejectionReason && <p className="text-sm text-red-600">Reason: {doc.rejectionReason}</p>}
                      </div>
                    </div>
                    <Badge
                      variant={
                        doc.status === "verified" ? "default" : doc.status === "rejected" ? "destructive" : "outline"
                      }
                    >
                      {doc.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Compliance Status</CardTitle>
              <CardDescription>Background checks and compliance requirements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span>Background Check</span>
                    <Badge
                      variant={
                        partner.compliance.backgroundCheck === "completed"
                          ? "default"
                          : partner.compliance.backgroundCheck === "failed"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {partner.compliance.backgroundCheck}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Training Completed</span>
                    <Badge variant={partner.compliance.trainingCompleted ? "default" : "outline"}>
                      {partner.compliance.trainingCompleted ? "Yes" : "No"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Insurance Valid</span>
                    <Badge variant={partner.compliance.insuranceValid ? "default" : "destructive"}>
                      {partner.compliance.insuranceValid ? "Valid" : "Invalid"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>License Valid</span>
                    <Badge variant={partner.compliance.licenseValid ? "default" : "destructive"}>
                      {partner.compliance.licenseValid ? "Valid" : "Invalid"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">{partner.compliance.complianceScore}%</div>
                    <p className="text-sm text-muted-foreground">Overall Compliance Score</p>
                    <Progress value={partner.compliance.complianceScore} className="mt-2" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
              <CardDescription>Monthly performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Performance charts will be implemented</p>
                <p className="text-sm">with analytics integration</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payouts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payout History</CardTitle>
              <CardDescription>Payment history and pending payouts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Request Date</TableHead>
                      <TableHead>Processed Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payouts.map((payout) => (
                      <TableRow key={payout.id}>
                        <TableCell className="font-medium">{payout.period}</TableCell>
                        <TableCell>{formatCurrency(payout.amount)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              payout.status === "completed"
                                ? "default"
                                : payout.status === "processing"
                                  ? "secondary"
                                  : payout.status === "failed"
                                    ? "destructive"
                                    : "outline"
                            }
                          >
                            {payout.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(payout.requestDate)}</TableCell>
                        <TableCell>{payout.processedDate ? formatDate(payout.processedDate) : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscription" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Subscription Details</CardTitle>
              <CardDescription>Current subscription plan and usage</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Plan</label>
                    <p className="text-lg font-bold capitalize">{partner.subscription.plan}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Monthly Fee</label>
                    <p className="text-lg font-bold">{formatCurrency(partner.subscription.monthlyFee)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Status</label>
                    <div className="mt-1">
                      <Badge
                        variant={
                          partner.subscription.status === "active"
                            ? "default"
                            : partner.subscription.status === "expired"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {partner.subscription.status}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Slot Usage</label>
                    <div className="mt-2">
                      <div className="flex justify-between text-sm">
                        <span>
                          {partner.subscription.usedSlots} / {partner.subscription.slots} slots
                        </span>
                        <span>{Math.round((partner.subscription.usedSlots / partner.subscription.slots) * 100)}%</span>
                      </div>
                      <Progress
                        value={(partner.subscription.usedSlots / partner.subscription.slots) * 100}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Subscription Period</label>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(partner.subscription.startDate)} - {formatDate(partner.subscription.endDate)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
