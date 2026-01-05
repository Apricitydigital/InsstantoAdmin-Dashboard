// // Minimal client-only Firebase initialization for auth + firestore

// import { initializeApp, type FirebaseApp } from "firebase/app"
// import { getAuth, type Auth } from "firebase/auth"
// import { getFirestore, type Firestore } from "firebase/firestore"

// let app: FirebaseApp | undefined
// let authInstance: Auth | undefined
// let dbInstance: Firestore | undefined

// export function getFirebaseApp() {
//   if (!app) {
//     app = initializeApp({
//       apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
//       authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
//       projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
//       storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
//       messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
//       appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
//     })
//   }
//   return app
// }

// export function getFirebaseAuth() {
//   if (!authInstance) {
//     authInstance = getAuth(getFirebaseApp())
//   }
//   return authInstance
// }

// export function getFirestoreDb() {
//   if (!dbInstance) {
//     dbInstance = getFirestore(getFirebaseApp())
//   }
//   return dbInstance
// }

// lib/firebase.ts

import { initializeApp, type FirebaseApp } from "firebase/app"
import { getAuth, type Auth } from "firebase/auth"
import { getFirestore, type Firestore } from "firebase/firestore"

let app: FirebaseApp | undefined
let authInstance: Auth | undefined
let dbInstance: Firestore | undefined

// Function to initialize and return Firebase App
export function getFirebaseApp() {
  if (!app) {
    app = initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
    })
  }
  return app
}

// Function to initialize and return Firebase Authentication
export function getFirebaseAuth() {
  if (!authInstance) {
    authInstance = getAuth(getFirebaseApp())
  }
  return authInstance
}

// Function to initialize and return Firestore instance (previously getFirestoreDb)
export function getFirestoreDb() {
  if (!dbInstance) {
    dbInstance = getFirestore(getFirebaseApp())
  }
  return dbInstance
}
