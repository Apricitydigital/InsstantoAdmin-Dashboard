"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { CheckCircle2, FileImage, Loader2, RotateCcw, ShieldCheck, XCircle } from "lucide-react"
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"
import { useAuth } from "@/lib/auth"
import { useToast } from "@/hooks/use-toast"

interface PartnerDocumentsSectionProps {
  partnerId: string
}

type DocumentFields = {
  photo?: string
  adhaarFront?: string
  adhaarBack?: string
  panCard?: string
  bankPassbook?: string
  policeVerification?: string
  certifications?: string
  medicalCertificate?: string
  electricityBill?: string
  rentAgreement?: string
  partnerSign?: string
}

export function PartnerDocumentsSection({ partnerId }: PartnerDocumentsSectionProps) {
  const db = getFirestoreDb()
  const { user } = useAuth()
  const { toast } = useToast()

  const [docs, setDocs] = useState<DocumentFields | null>(null)
  const [loading, setLoading] = useState(true)
  const [partnerStatus, setPartnerStatus] = useState("")
  const [kycStatus, setKycStatus] = useState("")
  const [verifying, setVerifying] = useState(false)
  const [reviewDecision, setReviewDecision] = useState<"verify" | "unverify" | null>(null)
  const [confirmationChecked, setConfirmationChecked] = useState(false)

  // Modal preview state
  const [previewImg, setPreviewImg] = useState<string | null>(null)

  // Keep both the uploaded form and its review state current while the
  // superadmin is inspecting the submission.
  useEffect(() => {
    if (!partnerId) return

    setLoading(true)
    const partnerRef = doc(db, "customer", partnerId)
    const formQuery = query(
      collection(db, "form_details"),
      where("provider_ref", "==", partnerRef)
    )

    const unsubscribeForm = onSnapshot(formQuery, (snapshot) => {
      if (snapshot.empty) {
        setDocs(null)
      } else {
        const data = snapshot.docs[0].data()
        setDocs({
          photo: data.photo || undefined,
          adhaarFront: data.adhaarFront ?? data.aadharFront ?? data.aadhaarFront ?? undefined,
          adhaarBack: data.adhaarBack ?? data.aadharBack ?? data.aadhaarBack ?? undefined,
          panCard: data.panCard || undefined,
          bankPassbook: data.bankPassbook || undefined,
          policeVerification: data.policeVerification || undefined,
          certifications: data.certifications || undefined,
          medicalCertificate: data.medicalCertificate || undefined,
          electricityBill: data.electricityBill || undefined,
          rentAgreement: data.rentAgreement || undefined,
          partnerSign: data.PartnerSign || data.partnerSign || undefined,
        })
      }
      setLoading(false)
    }, (error) => {
      console.error("Failed to load documents:", error)
      setLoading(false)
    })

    const unsubscribePartner = onSnapshot(partnerRef, (snapshot) => {
      const data = snapshot.data()
      setPartnerStatus(String(data?.partner_status || "Information_Unverified"))
      setKycStatus(String(data?.kyc_status || "pending"))
    })

    return () => {
      unsubscribeForm()
      unsubscribePartner()
    }
  }, [partnerId, db])

  const uploadedCount = useMemo(
    () => docs ? Object.values(docs).filter(Boolean).length : 0,
    [docs]
  )

  const isVerified = partnerStatus === "Information_Verified"
  const isUnverified = !isVerified && ["unverified", "rejected"].includes(kycStatus.toLowerCase())
  const canVerify = user?.role === "superadmin"

  const verifyDocuments = async () => {
    if (!canVerify || !uploadedCount || isVerified) return

    setVerifying(true)
    try {
      await updateDoc(doc(db, "customer", partnerId), {
        partner_status: "Information_Verified",
        kyc_status: "verified",
        information_verified_at: serverTimestamp(),
        information_verified_by: user.id,
      })
      toast({
        title: "Partner information verified",
        description: "The document review is complete and the partner status is now Information Verified.",
      })
      setReviewDecision(null)
    } catch (error) {
      console.error("Failed to verify partner documents:", error)
      toast({
        title: "Verification failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setVerifying(false)
    }
  }

  const unverifyDocuments = async () => {
    if (!canVerify || !uploadedCount) return

    setVerifying(true)
    try {
      await updateDoc(doc(db, "customer", partnerId), {
        partner_status: "Information_Unverified",
        kyc_status: "unverified",
        information_verified_at: null,
        information_verified_by: null,
        information_unverified_at: serverTimestamp(),
        information_unverified_by: user.id,
      })
      toast({
        title: "Partner documents marked unverified",
        description: "The documents require correction and the partner status is now Information Unverified.",
      })
      setReviewDecision(null)
    } catch (error) {
      console.error("Failed to unverify partner documents:", error)
      toast({
        title: "Could not reverse verification",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setVerifying(false)
    }
  }

  const renderImage = (src?: string) => {
    if (!src) return <p className="text-muted-foreground text-sm">Not uploaded</p>

    return (
      <div
        className="rounded-lg border p-2 bg-white shadow-sm cursor-pointer hover:scale-[1.02] transition"
        onClick={() => setPreviewImg(src)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="Document"
          className="w-full h-48 object-cover rounded-md border"
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading partner documents...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AlertDialog
        open={reviewDecision !== null}
        onOpenChange={(open) => {
          if (!open && !verifying) {
            setReviewDecision(null)
            setConfirmationChecked(false)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirm document {reviewDecision === "verify" ? "verification" : "rejection"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {reviewDecision === "verify"
                ? "This will mark the partner's information and KYC documents as verified."
                : "This will mark the documents as unverified and return the partner for correction."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
            <Checkbox
              checked={confirmationChecked}
              onCheckedChange={(checked) => setConfirmationChecked(checked === true)}
              className="mt-0.5"
            />
            <span>
              I have checked the uploaded documents and confirm this final decision.
            </span>
          </label>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={verifying}>Cancel</AlertDialogCancel>
            <Button
              variant={reviewDecision === "unverify" ? "destructive" : "default"}
              disabled={!confirmationChecked || verifying}
              onClick={() => {
                if (reviewDecision === "verify") void verifyDocuments()
                if (reviewDecision === "unverify") void unverifyDocuments()
              }}
            >
              {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm {reviewDecision === "verify" ? "verification" : "unverification"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Preview Modal */}
      <Dialog open={!!previewImg} onOpenChange={() => setPreviewImg(null)}>
        <DialogContent className="max-w-4xl">
          {previewImg && (
            <img
              src={previewImg}
              alt="Preview"
              className="w-full max-h-[85vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>

      <Card className={isVerified
        ? "border-emerald-200 bg-emerald-50/50"
        : isUnverified
          ? "border-red-200 bg-red-50/50"
          : "border-amber-200 bg-amber-50/50"}>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className={isVerified
              ? "rounded-full bg-emerald-100 p-2"
              : isUnverified
                ? "rounded-full bg-red-100 p-2"
                : "rounded-full bg-amber-100 p-2"}>
              {isVerified
                ? <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                : isUnverified
                  ? <XCircle className="h-5 w-5 text-red-700" />
                  : <ShieldCheck className="h-5 w-5 text-amber-700" />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">Document verification</p>
                <Badge variant="outline" className={isVerified
                  ? "border-emerald-300 text-emerald-700"
                  : isUnverified
                    ? "border-red-300 text-red-700"
                    : "border-amber-300 text-amber-700"}>
                  {isVerified ? "Information Verified" : isUnverified ? "Documents Unverified" : "Review required"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {uploadedCount} document{uploadedCount === 1 ? "" : "s"} uploaded. Open each file below before approving the submission.
              </p>
            </div>
          </div>

          {canVerify && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={() => {
                  setConfirmationChecked(false)
                  setReviewDecision("verify")
                }}
                disabled={!uploadedCount || verifying || isVerified}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Verify
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setConfirmationChecked(false)
                  setReviewDecision("unverify")
                }}
                disabled={!uploadedCount || verifying || isUnverified}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Unverify
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileImage className="w-5 h-5" />
            Partner Documents
          </CardTitle>
        </CardHeader>

        <CardContent>
          {/* Identity Section */}
          <div className="pb-4">
            <h3 className="text-lg font-semibold mb-3">Identity Proof</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="font-medium mb-2 text-sm">Photo</p>
                {renderImage(docs?.photo)}
              </div>
              <div>
                <p className="font-medium mb-2 text-sm">Adhaar Front</p>
                {renderImage(docs?.adhaarFront)}
              </div>
              <div>
                <p className="font-medium mb-2 text-sm">Adhaar Back</p>
                {renderImage(docs?.adhaarBack)}
              </div>
            </div>
          </div>

          {/* Financial Docs */}
          <div className="pb-4">
            <h3 className="text-lg font-semibold mb-3">Financial Docs</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="font-medium mb-2 text-sm">PAN Card</p>
                {renderImage(docs?.panCard)}
              </div>
              <div>
                <p className="font-medium mb-2 text-sm">Bank Passbook</p>
                {renderImage(docs?.bankPassbook)}
              </div>
              <div>
                <p className="font-medium mb-2 text-sm">Partner Signature</p>
                {renderImage(docs?.partnerSign)}
              </div>
            </div>
          </div>

          {/* Verification Docs */}
          <div className="pb-4">
            <h3 className="text-lg font-semibold mb-3">Verification Documents</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="font-medium mb-2 text-sm">Police Verification</p>
                {renderImage(docs?.policeVerification)}
              </div>
              <div>
                <p className="font-medium mb-2 text-sm">Medical Certificate</p>
                {renderImage(docs?.medicalCertificate)}
              </div>
              <div>
                <p className="font-medium mb-2 text-sm">Certifications</p>
                {renderImage(docs?.certifications)}
              </div>
            </div>
          </div>

          {/* Address Docs */}
          <div className="pb-4">
            <h3 className="text-lg font-semibold mb-3">Address Proof</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="font-medium mb-2 text-sm">Electricity Bill</p>
                {renderImage(docs?.electricityBill)}
              </div>
              <div>
                <p className="font-medium mb-2 text-sm">Rent Agreement</p>
                {renderImage(docs?.rentAgreement)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
