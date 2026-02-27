import { getFirestoreDb } from "@/lib/firebase";
import { PROVIDER_ID_LIST } from "@/lib/queries/partners";
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
  totalRevenue: number;
  mostBookedService: string;
  services: {
    serviceName: string;
    bookings: number;
    revenue: number;
  }[];
};


// Firestore document types
type SubCategoryDoc = {
  name: string;
  service_subCategory?: DocumentReference<DocumentData>;
   service_category_id?: DocumentReference<DocumentData>;
};

type CategoryDoc = {
  name: string;
};
type ServiceCategoryDoc = {
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

    // Use only first 3 providers for service filtering
    const allowedProviders = PROVIDER_ID_LIST.slice(0, 3);

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
      const serviceName = data.name;
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
    const allowedProviders = PROVIDER_ID_LIST;

    const filters: any[] = [where("status", "==", "Service_Completed")];

    if (fromDate && toDate) {
      const start = Timestamp.fromDate(new Date(fromDate + "T00:00:00Z"));
      const end = Timestamp.fromDate(new Date(toDate + "T23:59:59Z"));
      filters.push(where("date", ">=", start));
      filters.push(where("date", "<=", end));
    }

    const q = query(collection(db, "bookings"), ...filters);
    const snapshot = await getDocs(q);

    if (snapshot.empty) return [];

    const bookings = snapshot.docs
      .map((d) => d.data())
      .filter((b) => {
        const providerId = b.provider_id?.id || b.provider_id;
        return allowedProviders.includes(providerId);
      });

    if (bookings.length === 0) return [];

    // 🔹 STEP 1: Collect unique sub_categoryCart refs
    const cartRefs = new Set<string>();
    bookings.forEach((b) => {
      if (b.subCategoryCart_id?.path) {
        cartRefs.add(b.subCategoryCart_id.path);
      }
    });

    // 🔹 STEP 2: Resolve cart → subcategory → category
    const subCategoryDataMap = new Map<
      string,
      { serviceName: string; categoryName: string }
    >();

    await Promise.all(
      Array.from(cartRefs).map(async (cartPath) => {
        const cartSnap = await getDoc(doc(db, cartPath));
        const cartData = cartSnap.data();
        if (!cartData) return;

        const subCategoryRef =
          cartData.service_subCategory as DocumentReference | undefined;

        if (!subCategoryRef) return;

        const subSnap = await getDoc(subCategoryRef);
        const subData = subSnap.data() as SubCategoryDoc | undefined;
        if (!subData) return;

        const categoryRef =
          subData.service_category_id as DocumentReference | undefined;

        let categoryName = "Uncategorized";

        if (categoryRef) {
          const categorySnap = await getDoc(categoryRef);
          const categoryData =
            categorySnap.data() as ServiceCategoryDoc | undefined;

          if (categoryData?.name) {
            categoryName = categoryData.name;
          }
        }

        subCategoryDataMap.set(cartPath, {
          serviceName: subData.name,
          categoryName,
        });
      })
    );

    // 🔹 STEP 3: Aggregate
    const categoryStats: Record<
      string,
      {
        totalBookings: number;
        totalRevenue: number;
        services: Record<string, { bookings: number; revenue: number }>;
      }
    > = {};

    bookings.forEach((booking) => {
      const cartPath = booking.subCategoryCart_id?.path;
      if (!cartPath) return;

      const mapping = subCategoryDataMap.get(cartPath);
      if (!mapping) return;

      const { serviceName, categoryName } = mapping;
      const amount = Number(booking.amount_paid || 0);

      if (!categoryStats[categoryName]) {
        categoryStats[categoryName] = {
          totalBookings: 0,
          totalRevenue: 0,
          services: {},
        };
      }

      categoryStats[categoryName].totalBookings += 1;
      categoryStats[categoryName].totalRevenue += amount;

      if (!categoryStats[categoryName].services[serviceName]) {
        categoryStats[categoryName].services[serviceName] = {
          bookings: 0,
          revenue: 0,
        };
      }

      categoryStats[categoryName].services[serviceName].bookings += 1;
      categoryStats[categoryName].services[serviceName].revenue += amount;
    });

    // 🔹 STEP 4: Format Output
    return Object.entries(categoryStats)
      .map(([categoryName, data]) => {
        const sortedServices = Object.entries(data.services)
          .sort((a, b) => b[1].bookings - a[1].bookings)
          .map(([serviceName, s]) => ({
            serviceName,
            bookings: s.bookings,
            revenue: s.revenue,
          }));

        return {
          categoryName,
          totalBookings: data.totalBookings,
          totalRevenue: data.totalRevenue,
          mostBookedService: sortedServices[0]?.serviceName || "",
          services: sortedServices,
        };
      })
      .sort((a, b) => b.totalBookings - a.totalBookings);
  } catch (error) {
    console.error("Error fetching top categories:", error);
    return [];
  }
}