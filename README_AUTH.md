# Auth & RBAC Setup (Firebase)

This project uses Firebase Authentication (Email/Password) and Firestore for roles/permissions.

## 1) Configure environment
Copy `.env.example` to `.env` and fill out Firebase client config. For local scripts/functions, set:
- FIREBASE_PROJECT_ID
- GOOGLE_APPLICATION_CREDENTIALS (path to serviceAccountKey.json)

## 2) Initialize Firebase
- Ensure a Firebase project exists.
- Enable Email/Password sign-in in Authentication.

## 3) Firestore Rules
Deploy or emulate the rules in `firebase/firestore.rules`.

## 4) Seed Roles
Run the Node script (requires firebase-admin):
- ts-node scripts/seed-roles.ts

This creates `roles/{roleId}` docs with the permissions arrays.

## 5) Create Users and Assign Roles (superadmin only)
Deploy Cloud Functions in `/functions` or run the emulator:
- Functions expose callable endpoints:
  - `createUser({ email, password, name, roleId })`
  - `setUserRole({ uid, roleId })`
They also mirror `roleId` into custom claims and revoke tokens to force refresh.

## 6) App Integration
- `lib/firebase.ts` initializes Firebase on the client.
- `lib/auth.tsx` provides `<AuthProvider>` and the `useAuth()` hook.
- Guards:
  - `<ProtectedRoute roles={['admin']}>...</ProtectedRoute>`
  - `<ProtectedRoute requiredPermission="payments:view">...</ProtectedRoute>`
  - `<Can permission="coupons:view">...</Can>`
Place these wrappers around pages or sections as needed. The layout already injects `<AuthProvider>` globally.

## 7) Replace mock data
Migrate data reads to Firestore in feature services/hooks, preserving component props. Do this incrementally without changing UI markup.

## 8) Emulators (optional)
Use Firebase emulators for Auth/Firestore/Functions during development, then deploy rules/functions to your project.
