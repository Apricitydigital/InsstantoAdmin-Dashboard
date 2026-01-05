"use client"

import { useEffect, useState } from "react"
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  orderBy,
  limit,
  startAfter,
  getCountFromServer,
  where,
  DocumentData,
  DocumentReference,
} from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"
import { AdminSidebar } from "@/components/admin-sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Package, ShoppingCart, Users, Plus, TrendingUp, ArrowLeft, ArrowRight } from "lucide-react"

/* ---------- TYPES ---------- */
interface StoreItem {
  id: string
  product_name: string
  product_company: string
  unit: string
  stock: string
  price: number
}

interface ChemicalPurchase {
  id: string
  partnerId?: DocumentReference<DocumentData> | string
  purchase_date?: any
  amount_paid?: number
  status?: string
  PaymentType?: string
  partnerName?: string
}

/* ---------- MAIN COMPONENT ---------- */
export default function StorePage() {
  const db = getFirestoreDb()

  const [products, setProducts] = useState<StoreItem[]>([])
  const [orders, setOrders] = useState<ChemicalPurchase[]>([])
  const [loading, setLoading] = useState(true)
  const [kpiLoading, setKpiLoading] = useState(true)

  // Pagination
  const [lastProductDoc, setLastProductDoc] = useState<any>(null)
  const [lastOrderDoc, setLastOrderDoc] = useState<any>(null)
  const [productPage, setProductPage] = useState(1)
  const [orderPage, setOrderPage] = useState(1)
  const pageSize = 10

  // Partner cache to avoid redundant Firestore reads
  const partnerCache = new Map<string, string>()

  /* ---------- KPI DATA ---------- */
  const [kpiData, setKpiData] = useState({
    totalProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    monthlyRevenue: 0,
    monthlyOrders: 0,
  })

  /* ---------- FETCH PAGINATED PRODUCTS ---------- */
  const fetchProducts = async (next = false) => {
    setLoading(true)
    try {
      const colRef = collection(db, "store_items")
      let q = query(colRef, orderBy("product_name"), limit(pageSize))
      if (next && lastProductDoc)
        q = query(colRef, orderBy("product_name"), startAfter(lastProductDoc), limit(pageSize))

      const snapshot = await getDocs(q)
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as StoreItem[]
      setProducts(data)
      setLastProductDoc(snapshot.docs[snapshot.docs.length - 1])
    } catch (error) {
      console.error("Error fetching products:", error)
    } finally {
      setLoading(false)
    }
  }

  /* ---------- FETCH PAGINATED ORDERS (OPTIMIZED + FIXED) ---------- */
const fetchOrders = async (next = false) => {
  setLoading(true)
  try {
    const colRef = collection(db, "chemical_purchase_record")
    let q = query(colRef, orderBy("purchase_date", "desc"), limit(pageSize))
    if (next && lastOrderDoc)
      q = query(colRef, orderBy("purchase_date", "desc"), startAfter(lastOrderDoc), limit(pageSize))

    const snapshot = await getDocs(q)

    const orderData: ChemicalPurchase[] = await Promise.all(
      snapshot.docs.map(async (d) => {
        const data = d.data() as ChemicalPurchase
        const order: ChemicalPurchase = {
          ...data,
          id: d.id,
          partnerName: "Unknown",
        }

        try {
          if (data.partnerId && typeof data.partnerId !== "string") {
            // 🔹 Step 1: Fetch the partner document reference stored in partnerId
            const partnerRef = data.partnerId as DocumentReference<DocumentData>
            const partnerDoc = await getDoc(partnerRef)

            if (partnerDoc.exists()) {
              const partnerData = partnerDoc.data()

              // 🔹 Step 2: Use customer_name directly from the referenced customer document
              const customerName =
                partnerData.customer_name ||
                partnerData.display_name ||
                partnerData.name ||
                "Unnamed Partner"

              order.partnerName = customerName
            }
          }
        } catch (err) {
          console.warn(`Failed to fetch partner for order ${d.id}:`, err)
        }

        return order
      })
    )

    setOrders(orderData)
    setLastOrderDoc(snapshot.docs[snapshot.docs.length - 1])
  } catch (error) {
    console.error("Error fetching orders:", error)
  } finally {
    setLoading(false)
  }
}


  /* ---------- FETCH KPI DATA (OPTIMIZED) ---------- */
  const fetchKpiData = async () => {
    setKpiLoading(true)
    try {
      const productsRef = collection(db, "store_items")
      const ordersRef = collection(db, "chemical_purchase_record")

      const [productsCountSnap, ordersCountSnap, pendingOrdersSnap] = await Promise.all([
        getCountFromServer(productsRef),
        getCountFromServer(ordersRef),
        getCountFromServer(query(ordersRef, where("status", "==", "pending"))),
      ])

      const totalProducts = productsCountSnap.data().count
      const totalOrders = ordersCountSnap.data().count
      const pendingOrders = pendingOrdersSnap.data().count

      // Monthly stats
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthlyOrdersQuery = query(ordersRef, where("purchase_date", ">=", startOfMonth))
      const monthlyOrdersSnap = await getDocs(monthlyOrdersQuery)

      let monthlyOrders = 0
      let monthlyRevenue = 0
      monthlyOrdersSnap.forEach((doc) => {
        const data = doc.data() as ChemicalPurchase
        monthlyOrders++
        monthlyRevenue += data.amount_paid ?? 0
      })

      setKpiData({
        totalProducts,
        totalOrders,
        pendingOrders,
        monthlyRevenue,
        monthlyOrders,
      })
    } catch (error) {
      console.error("Error fetching KPI data:", error)
    } finally {
      setKpiLoading(false)
    }
  }

  /* ---------- USE EFFECT ---------- */
  useEffect(() => {
    fetchProducts()
    fetchOrders()
    fetchKpiData()
  }, [])

  /* ---------- PAGINATION HANDLERS ---------- */
  const handleNextProducts = () => {
    setProductPage((p) => p + 1)
    fetchProducts(true)
  }

  const handleNextOrders = () => {
    setOrderPage((p) => p + 1)
    fetchOrders(true)
  }

  /* ---------- RENDER ---------- */
  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar />
      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Store Management</h1>
            <p className="text-gray-600">
              Manage partner supplies, inventory, and vendor relationships
            </p>
          </div>
          <Button className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600">
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {kpiLoading ? (
            <p>Loading KPI data...</p>
          ) : (
            <>
              <KpiCard
                icon={<Package className="w-8 h-8 text-emerald-600" />}
                value={kpiData.totalProducts}
                label="Total Products"
                color="emerald"
              />
              <KpiCard
                icon={<ShoppingCart className="w-8 h-8 text-blue-600" />}
                value={kpiData.totalOrders}
                label="Total Orders"
                color="blue"
              />
              <KpiCard
                icon={<Users className="w-8 h-8 text-purple-600" />}
                value={kpiData.pendingOrders}
                label="Pending Orders"
                color="purple"
              />
              <KpiCard
                icon={<TrendingUp className="w-8 h-8 text-orange-600" />}
                value={`₹${kpiData.monthlyRevenue.toLocaleString()}`}
                label="Monthly Revenue"
                color="orange"
              />
              <KpiCard
                icon={<TrendingUp className="w-8 h-8 text-teal-600" />}
                value={kpiData.monthlyOrders}
                label="Monthly Orders"
                color="teal"
              />
            </>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-3">
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="vendors">Vendors</TabsTrigger>
          </TabsList>

          {/* Inventory Table */}
          <TabsContent value="inventory" className="space-y-4">
            <DataCard
              title="Inventory Management"
              description="All products available in the store"
              loading={loading}
              data={products}
              columns={[
                { key: "product_name", label: "Product Name" },
                { key: "product_company", label: "Company" },
                { key: "unit", label: "Unit" },
                { key: "stock", label: "Stock" },
                { key: "price", label: "Price (₹)" },
              ]}
              onNext={handleNextProducts}
              page={productPage}
            />
          </TabsContent>

          {/* Orders Table */}
          <TabsContent value="orders" className="space-y-4">
            <DataCard
              title="Partner Orders"
              description="Orders placed by service partners"
              loading={loading}
              data={orders}
              columns={[
                { key: "partnerName", label: "Partner Name" },
                { key: "status", label: "Status" },
                { key: "amount_paid", label: "Amount (₹)" },
                { key: "PaymentType", label: "Payment Type" },
                {
                  key: "purchase_date",
                  label: "Date",
                  render: (v: any) =>
                    v?.toDate ? v.toDate().toLocaleDateString() : "N/A",
                },
              ]}
              onNext={handleNextOrders}
              page={orderPage}
            />
          </TabsContent>

          {/* Vendors */}
          <TabsContent
            value="vendors"
            className="flex flex-col items-center justify-center space-y-4 h-full"
          >
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">No vendors</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

/* ---------- COMPONENTS ---------- */

function KpiCard({ icon, value, label, color }: any) {
  const colorMap: any = {
    emerald: "from-emerald-50 to-teal-50 border-emerald-200 text-emerald-900",
    blue: "from-blue-50 to-cyan-50 border-blue-200 text-blue-900",
    purple: "from-purple-50 to-violet-50 border-purple-200 text-purple-900",
    orange: "from-orange-50 to-amber-50 border-orange-200 text-orange-900",
    teal: "from-teal-50 to-green-50 border-teal-200 text-teal-900",
  }

  return (
    <Card className={`bg-gradient-to-br ${colorMap[color]} border`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          {icon}
          <Badge variant="secondary">{value}</Badge>
        </div>
        <CardTitle className="text-2xl font-bold">{value}</CardTitle>
        <CardDescription>{label}</CardDescription>
      </CardHeader>
    </Card>
  )
}

function DataCard({ title, description, data, columns, loading, onNext, page }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 text-sm">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    {columns.map((col: any) => (
                      <th key={col.key} className="p-2 text-left whitespace-nowrap">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row: any, i: number) => (
                    <tr key={i} className="border-t">
                      {columns.map((col: any) => (
                        <td key={col.key} className="p-2 whitespace-nowrap">
                          {col.render ? col.render(row[col.key]) : row[col.key] ?? "-"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex justify-end items-center gap-3 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => window.location.reload()}
              >
                <ArrowLeft className="w-4 h-4 mr-1" /> Prev
              </Button>
              <Button variant="outline" size="sm" onClick={onNext}>
                Next <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}