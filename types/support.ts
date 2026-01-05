export interface SupportTicket {
  id: string
  customerId: string
  customerName: string
  bookingId?: string
  type: "complaint" | "query" | "refund" | "technical"
  priority: "low" | "medium" | "high" | "urgent"
  status: "open" | "in_progress" | "resolved" | "closed"
  subject: string
  description: string
  assignedTo?: string
  createdAt: string
  updatedAt: string
  resolvedAt?: string
  note: string
}

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