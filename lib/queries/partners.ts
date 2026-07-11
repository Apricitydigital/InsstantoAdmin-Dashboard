  import { doc, DocumentReference } from "firebase/firestore";
  import { getFirestoreDb } from "@/lib/firebase";
  import { MATCHED_PATH_HEADER } from "next/dist/lib/constants";
  import { Main } from "next/document";

  /**
   * Raw provider IDs (single source of truth)
   */
  export const PROVIDER_IDS = {

    //Cleaning
    MAIN_1: "mwBcGMWLwDULHIS9hXx7JLuRfCi1",
    MAIN_2: "Dmoo33tCx0OU1HMtapISBc9Oeeq2",
    MAIN_3: "VxxapfO7l8YM5f6xmFqpThc17eD3",
    MAIN_4: "Q0kKYbdOKVbeZsdiLGsJoM5BWQl1",
    MAIN_5: "7KlujhUyJbeCTPG6Pty8exlxXuM2",
    MAIN_6: "fGLJCCFDEneQZ7ciz71Q29WBgGQ2",
    MAIN_7: "MstGdrDCHkZ1KKf0xtZctauIovf2",
    MAIN_8: "OgioZJvg0DWWRnqZLj2AUMUljZN2",

    //Electical
    MAIN_9: "uSZdJdat03froahSdGmPpFWDGhi2",
    MAIN_10: "B1FsSfpqRIPS6Sg0fn3QetCOyAw2",
    MAIN_11: "o5TaNl6ib3hp8TmZqXQnNsVKu9i2",
    MAIN_12: "kBfweNRyGWXi0IjQcYilZI1q5EJ2",
    MAIN_13: "mUcht1HeUBgSDr3WOK8c7n390yw2",
    MAIN_14: "dzE4YDyA7vTnMORlmQCw3ddrpHK2",
    MAIN_15: "UV0aQurqJweWQ8Jpr07p61IXkw12",
    MAIN_16: "2WIcexafTIcDIGZfIC8R6Gl1GP53",
    MAIN_17: "nvRnDzaahFQn3gkcnLBMcuT3DPt2",
    MAIN_18: "kXT1h0bQ6hX1nTDszpW1o2mPc8Z2",
    MAIN_19: "o37yfjhjUCMHfGNGk3sdeHzAkJp1",
    MAIN_20: "H3DMe9P0ZocAfIHPx4zS5Dnm0l83",
    MAIN_21: "2ZZQSPFOD4gXTUGN2gdLWgwlFyz1",

      //Driver
    MAIN_22: "vFbzKfPAbQQY372A3UpCs7OQeKt2",
    MAIN_23: "eCpkIc6cuAc22JAflH7FxA9wTzt1",
    MAIN_24: "WEED0oEJ9LMmLF4gvPYu7XLdlC23",
    MAIN_25: "qC9hQAvpuKdOLzcaoENEgz7B6lc2",
    MAIN_26: "uwkwGd6uFJSdQYyD9cDkDMchtb73",
    MAIN_27: "7eSKpgTzBmgQI6Vk8J48nd5jpgw1",
    // MAIN_28: "leSRSHrBEOQyfBn8HQz9CggV3Wt1",
    // MAIN_29: "bsmsDMTdoSMa0A7b6GOdAYPKmi13",
    // MAIN_30: "GDJYByLf7meMvXGGx245JCW36Oi2",
    MAIN_31: "X3gGSFQw4eOAUAZ4SqboA7iKRVv2",
    // MAIN_32: "T3ZT57F8Q1dkJsrpfo2tpsGJpes1",
    // MAIN_33: "9dBEvv1sqNgM5V4D9wv3oGPMlHr2",
    // MAIN_34: "JVQI5xhTZoYdN5uMpj9u8JdDism2",
    // MAIN_35: "UkdYgwdjXjVfIkSHf1ceyMOiBkn1",
    // MAIN_36: "QJZKiLei8SSck6TztQaiGyGhltV2",
    // MAIN_37: "X6YsdWNfmefDniPdSYxaAAsDJNB3",
    // MAIN_38: "G1aprieOdxeYv5xoQOp43wAUNHT2",
    // MAIN_39: "vbxFCztRxXhpIAYBKFPK3SgVLhp2",
    // MAIN_40: "708tIrehVQdZ06oRPvuXn4MeXxG2",


    //Security
    MAIN_41: "LcyiGATf91hXEg2dSVAHB2UJ32u2",



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
