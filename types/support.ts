export interface SupportTicket {
  id: string
  customerId: string
  customerName: string
  bookingId?: string
  type: "complaint" | "query" | "refund" | "technical"
  category: ComplaintCategory
  isRepeatedComplaint: boolean
  isDuplicateComplaint: boolean
  relatedComplaintCount: number
  priority: "low" | "medium" | "high" | "urgent"
  status: "open" | "in_progress" | "resolved" | "closed"
  subject: string
  description: string
  assignedTo?: string
  createdAt: string
  contact_no: string
  updatedAt: string
  resolvedAt?: string
  note: string
  resolutionNote?: string
}

export type ComplaintCategory =
  | "general"
  | "duplicate_payment"
  | "payment_refund"
  | "service_related"
  | "app_technical"
  | "booking_related"
  | "provider_related"
  | "account_related"

export interface Review {
  id: string
  customerId: string
  customerName: string
  partnerId: string
  partnerName: string
  bookingId: string
  serviceId: string

  serviceName: string
  rating: number
  comment: string
  isPublic: boolean
  createdAt: string
}
