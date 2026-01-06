import { doc, DocumentReference } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { MATCHED_PATH_HEADER } from "next/dist/lib/constants";

/**
 * Raw provider IDs (single source of truth)
 */
export const PROVIDER_IDS = {
  MAIN_1: "mwBcGMWLwDULHIS9hXx7JLuRfCi1",
  MAIN_2: "Dmoo33tCx0OU1HMtapISBc9Oeeq2",
  MAIN_3: "VxxapfO7l8YM5f6xmFqpThc17eD3",
  MAIN_4: "Q0kKYbdOKVbeZsdiLGsJoM5BWQl1",
  MAIN_5: "7KlujhUyJbeCTPG6Pty8exlxXuM2",
  MAIN_6: "fGLJCCFDEneQZ7ciz71Q29WBgGQ2",
  MAIN_7: "MstGdrDCHkZ1KKf0xtZctauIovf2",
  MAIN_8: "OgioZJvg0DWWRnqZLj2AUMUljZN2",
  MAIN_9: "uSZdJdat03froahSdGmPpFWDGhi2",
  MAIN_10: "B1FsSfpqRIPS6Sg0fn3QetCOyAw2",
} as const;

/**
 * Array version (most commonly used)
 */
export const PROVIDER_ID_LIST = Object.values(PROVIDER_IDS);

/**
 * Firestore DocumentReferences
 * (useful for `where("in")` queries)
 */
export function getProviderRefs(): DocumentReference[] {
  const db = getFirestoreDb();
  return PROVIDER_ID_LIST.map((id) =>
    doc(db, "customer", id)
  );
}
