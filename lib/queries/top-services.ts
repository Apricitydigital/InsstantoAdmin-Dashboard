import { getFirestoreDb } from "@/lib/firebase";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  DocumentReference,
  DocumentData,
  query,
  where,
  Timestamp,
} from "firebase/firestore";

export type TopService = {
  name: string;
  bookings: number;
  category?: string;
};

export type TopCategory = {
  categoryName: string;
  totalBookings: number;
  topService: string;
  totalRevenue?: number;
};


// Firestore document types
type SubCategoryDoc = {
  service_name: string;
  service_subCategory?: DocumentReference<DocumentData>;
};

type CategoryDoc = {
  name: string;
};

/* -------------------------------------------------------------------------- */
/*                        FETCH TOP SERVICES (DATE RANGE)                     */
/* -------------------------------------------------------------------------- */
export async function fetchTopServices(
  fromDate?: string,
  toDate?: string
): Promise<TopService[]> {
  try {
    const db = getFirestoreDb();

    // Base query for completed bookings
    const baseQuery = collection(db, "bookings");
    const filters: any[] = [where("status", "==", "Service_Completed")];

    // ✅ Apply date filter using Firestore Timestamps
    if (fromDate && toDate) {
      const start = Timestamp.fromDate(new Date(fromDate + "T00:00:00Z"));
      const end = Timestamp.fromDate(new Date(toDate + "T23:59:59Z"));
      filters.push(where("date", ">=", start));
      filters.push(where("date", "<=", end));
    }

    const q = query(baseQuery, ...filters);
    const snapshot = await getDocs(q);

    const allowedProviders = [
      "VxxapfO7l8YM5f6xmFqpThc17eD3",
      "mwBcGMWLwDULHIS9hXx7JLuRfCi1",
      "Dmoo33tCx0OU1HMtapISBc9Oeeq2",
    ];

    const bookingsBySubCat: Record<string, number> = {};
    const subCategoryRefs: Set<string> = new Set();

    // Count bookings per subcategory (filtered by allowed providers)
    for (const docSnap of snapshot.docs) {
      const booking = docSnap.data();
      const providerId = booking.provider_id?.id || booking.provider_id;
      if (!allowedProviders.includes(providerId)) continue;

      const subCatRef: DocumentReference<DocumentData> | undefined =
        booking.subCategoryCart_id;
      if (!subCatRef) continue;

      subCategoryRefs.add(subCatRef.path);
      bookingsBySubCat[subCatRef.path] =
        (bookingsBySubCat[subCatRef.path] || 0) + 1;
    }

    // Fetch subcategory and category names
    const subCatDocs = await Promise.all(
      Array.from(subCategoryRefs).map(async (path) => {
        const subCatSnap = await getDoc(doc(db, path));
        const subCatData = subCatSnap.data() as SubCategoryDoc | undefined;

        let categoryName: string | undefined;
        if (subCatData?.service_subCategory) {
          const categorySnap = await getDoc(subCatData.service_subCategory);
          const categoryData = categorySnap.data() as CategoryDoc | undefined;
          categoryName = categoryData?.name;
        }

        return { path, data: subCatData, category: categoryName };
      })
    );

    const serviceData: Record<string, { count: number; category?: string }> = {};

    // Aggregate booking counts per service
    for (const { path, data, category } of subCatDocs) {
      if (!data) continue;
      const serviceName = data.service_name;
      if (!serviceName) continue;
      const count = bookingsBySubCat[path] || 0;

      if (serviceData[serviceName]) {
        serviceData[serviceName].count += count;
      } else {
        serviceData[serviceName] = { count, category };
      }
    }

    // Sort and return structured data
    return Object.entries(serviceData)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, data]) => ({
        name,
        bookings: data.count,
        category: data.category,
      }));
  } catch (error) {
    console.error("Error fetching top services:", error);
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/*                       FETCH TOP CATEGORIES (DATE RANGE)                    */
/* -------------------------------------------------------------------------- */
export async function fetchTopCategories(
  fromDate?: string,
  toDate?: string
): Promise<TopCategory[]> {
  try {
    const db = getFirestoreDb();

    // ✅ Allowed providers
    const allowedProviders = [
      "mwBcGMWLwDULHIS9hXx7JLuRfCi1",
      "Dmoo33tCx0OU1HMtapISBc9Oeeq2",
      "VxxapfO7l8YM5f6xmFqpThc17eD3",
      "Q0kKYbdOKVbeZsdiLGsJoM5BWQl1",
      "7KlujhUyJbeCTPG6Pty8exlxXuM2",
      "fGLJCCFDEneQZ7ciz71Q29WBgGQ2",
      "MstGdrDCHkZ1KKf0xtZctauIovf2",

    ];

    // ✅ Base query: completed bookings in range
    const baseQuery = collection(db, "bookings");
    const filters: any[] = [where("status", "==", "Service_Completed")];

    if (fromDate && toDate) {
      const start = Timestamp.fromDate(new Date(fromDate + "T00:00:00Z"));
      const end = Timestamp.fromDate(new Date(toDate + "T23:59:59Z"));
      filters.push(where("date", ">=", start));
      filters.push(where("date", "<=", end));
    }

    const q = query(baseQuery, ...filters);
    const snapshot = await getDocs(q);

    if (snapshot.empty) return [];

    const bookings = snapshot.docs
      .map((d) => d.data())
      .filter((b) => {
        const providerId = b.provider_id?.id || b.provider_id;
        return allowedProviders.includes(providerId);
      });

    if (bookings.length === 0) return [];

    // ✅ Collect unique subCategory references
    const subCategoryRefs = new Set<string>();
    for (const booking of bookings) {
      if (booking.subCategoryCart_id?.path) {
        subCategoryRefs.add(booking.subCategoryCart_id.path);
      }
    }

    // ✅ Fetch all subcategory docs only once
    const subCategoryDataMap = new Map<
      string,
      { serviceName: string; categoryName: string }
    >();

    await Promise.all(
      Array.from(subCategoryRefs).map(async (path) => {
        const subCatSnap = await getDoc(doc(db, path));
        const subCatData = subCatSnap.data() as SubCategoryDoc | undefined;
        if (!subCatData) return;

        let categoryName = "Uncategorized";
        if (subCatData.service_subCategory) {
          const categorySnap = await getDoc(subCatData.service_subCategory);
          const categoryData = categorySnap.data() as CategoryDoc | undefined;
          categoryName = categoryData?.name || "Uncategorized";
        }

        subCategoryDataMap.set(path, {
          serviceName: subCatData.service_name,
          categoryName,
        });
      })
    );

    // ✅ Aggregate bookings + revenue per category
    const categoryStats: Record<
      string,
      { totalBookings: number; totalRevenue: number; topService: string }
    > = {};

    for (const booking of bookings) {
      const subPath = booking.subCategoryCart_id?.path;
      const amount = Number(booking.amount_paid || 0);
      if (!subPath || !subCategoryDataMap.has(subPath)) continue;

      const { categoryName, serviceName } = subCategoryDataMap.get(subPath)!;

      if (!categoryStats[categoryName]) {
        categoryStats[categoryName] = {
          totalBookings: 0,
          totalRevenue: 0,
          topService: serviceName,
        };
      }

      categoryStats[categoryName].totalBookings += 1;
      categoryStats[categoryName].totalRevenue += amount;
    }

    // ✅ Sort by highest bookings
    return Object.entries(categoryStats)
      .sort((a, b) => b[1].totalBookings - a[1].totalBookings)
      .map(([categoryName, data]) => ({
        categoryName,
        totalBookings: data.totalBookings,
        topService: data.topService,
        totalRevenue: data.totalRevenue,
      }));
  } catch (error) {
    console.error("Error fetching top categories:", error);
    return [];
  }
}