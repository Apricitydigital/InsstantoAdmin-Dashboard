"use client"

import React, { useEffect, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Loader2, FileImage, FileText } from "lucide-react"
import { doc, collection, query, where, getDocs } from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"

interface PartnerDocumentsSectionProps {
  partnerId: string
}

type DocumentFields = {
  photo?: string
  aadhaarFront?: string
  aadhaarBack?: string
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

  const [docs, setDocs] = useState<DocumentFields | null>(null)
  const [loading, setLoading] = useState(true)

  // Modal preview state
  const [previewImg, setPreviewImg] = useState<string | null>(null)

  // Fetch documents
  useEffect(() => {
    if (!partnerId) return

    const fetchDocs = async () => {
      try {
        setLoading(true)
        const partnerRef = doc(db, "customer", partnerId)

        const formQuery = query(
          collection(db, "form_details"),
          where("provider_ref", "==", partnerRef)
        )

        const snapshot = await getDocs(formQuery)

        if (!snapshot.empty) {
          const data = snapshot.docs[0].data()
          setDocs({
            photo: data.photo || null,
            aadhaarFront: data.aadhaarFront || null,
            aadhaarBack: data.aadhaarBack || null,
            panCard: data.panCard || null,
            bankPassbook: data.bankPassbook || null,
            policeVerification: data.policeVerification || null,
            certifications: data.certifications || null,
            medicalCertificate: data.medicalCertificate || null,
            electricityBill: data.electricityBill || null,
            rentAgreement: data.rentAgreement || null,
            partnerSign: data.PartnerSign || null,
          })
        } else {
          setDocs(null)
        }
      } catch (err) {
        console.error("Failed to load documents:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchDocs()
  }, [partnerId, db])

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
                <p className="font-medium mb-2 text-sm">Aadhaar Front</p>
                {renderImage(docs?.aadhaarFront)}
              </div>
              <div>
                <p className="font-medium mb-2 text-sm">Aadhaar Back</p>
                {renderImage(docs?.aadhaarBack)}
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