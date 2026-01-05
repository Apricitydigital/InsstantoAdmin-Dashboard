// import * as admin from "firebase-admin"
// import * as functions from "firebase-functions"
// import { onCall, CallableRequest } from "firebase-functions/v2/https";

// if (!admin.apps.length) {
//   admin.initializeApp()
// }

// const db = admin.firestore()

// function assertSuperAdmin(context: functions.https.CallableContext) {
//   if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Auth required")
//   const claims = context.auth.token as any
//   if (!claims.roleId || claims.roleId !== "superadmin") {
//     throw new functions.https.HttpsError("permission-denied", "Superadmin only")
//   }
// }

// export const createUser = functions.https.onCall(async (data, context) => {
//   assertSuperAdmin(context)
//   const { email, password, name, roleId } = data as { email: string; password: string; name?: string; roleId: string }
//   const userRecord = await admin.auth().createUser({ email, password, displayName: name })
//   await db
//     .collection("users")
//     .doc(userRecord.uid)
//     .set({ email, name: name || null, roleId })
//   // Optionally mirror claim for faster checks
//   await admin.auth().setCustomUserClaims(userRecord.uid, { roleId })
//   await admin.auth().revokeRefreshTokens(userRecord.uid)
//   return { uid: userRecord.uid }
// })

// export const setUserRole = functions.https.onCall(async (data, context) => {
//   assertSuperAdmin(context)
//   const { uid, roleId } = data as { uid: string; roleId: string }
//   await db.collection("users").doc(uid).set({ roleId }, { merge: true })
//   await admin.auth().setCustomUserClaims(uid, { roleId })
//   await admin.auth().revokeRefreshTokens(uid)
//   return { ok: true }
// })

// import { getApps, initializeApp } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
// import { getFirestore } from "firebase-admin/firestore"
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https"

import * as admin from 'firebase-admin';  // Import Firebase Admin SDK


if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()


function assertSuperAdmin(request: CallableRequest) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required")
  const claims = request.auth.token as any
  if (!claims.roleId || claims.roleId !== "superadmin") {
    throw new HttpsError("permission-denied", "Superadmin only")
  }
}

export const createUser = onCall(async (request) => {
  assertSuperAdmin(request)
  const { email, password, name, roleId } = request.data as {
    email: string
    password: string
    name?: string
    roleId: string
  }

  const userRecord = await getAuth().createUser({ email, password, displayName: name })

  await db
    .collection("customer")
    .doc(userRecord.uid)
    .set({
      email,
      name: name || null,
      roleId,
    })

  await getAuth().setCustomUserClaims(userRecord.uid, { roleId })
  await getAuth().revokeRefreshTokens(userRecord.uid)

  return { uid: userRecord.uid }
})

export const setUserRole = onCall(async (request) => {
  assertSuperAdmin(request)
  const { uid, roleId } = request.data as { uid: string; roleId: string }

  await db.collection("customer").doc(uid).set({ roleId }, { merge: true })
  await getAuth().setCustomUserClaims(uid, { roleId })
  await getAuth().revokeRefreshTokens(uid)

  return { ok: true }
})
