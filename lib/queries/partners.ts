import {
  collection,
  doc,
  DocumentReference,
  Firestore,
  getDocs,
  query,
  where,
} from "firebase/firestore"

import { getFirestoreDb } from "@/lib/firebase"

export const ONBOARDED_PARTNER_STATUS = "Onboarded"

const PARTNER_CACHE_DURATION_MS = 60 * 1000

let partnerCache: { createdAt: number; ids: string[] } | undefined
let partnerRequest: Promise<string[]> | undefined

/**
 * Returns every currently onboarded partner. This is the single source of
 * truth for dashboard filtering; adding a partner no longer requires a code
 * change and is not constrained by Firestore's `in` query value limit.
 */
export async function getOnboardedPartnerIds(
  database: Firestore = getFirestoreDb()
): Promise<string[]> {
  const now = Date.now()

  if (partnerCache && now - partnerCache.createdAt < PARTNER_CACHE_DURATION_MS) {
    return partnerCache.ids
  }

  if (partnerRequest) return partnerRequest

  partnerRequest = getDocs(
    query(
      collection(database, "customer"),
      where("partner_status", "==", ONBOARDED_PARTNER_STATUS)
    )
  ).then((snapshot) => {
    const ids = snapshot.docs.map((partner) => partner.id)
    partnerCache = { createdAt: Date.now(), ids }
    return ids
  })

  try {
    return await partnerRequest
  } finally {
    partnerRequest = undefined
  }
}

export async function getOnboardedPartnerRefs(
  database: Firestore = getFirestoreDb()
): Promise<DocumentReference[]> {
  const ids = await getOnboardedPartnerIds(database)
  return ids.map((id) => doc(database, "customer", id))
}

export async function getOnboardedPartnerIdSet(
  database: Firestore = getFirestoreDb()
): Promise<Set<string>> {
  return new Set(await getOnboardedPartnerIds(database))
}
