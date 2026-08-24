import {
  collection,
  addDoc,
  deleteField,
  doc,
  DocumentData,
  DocumentReference,
  getDoc,
  getDocs,
  runTransaction,
  updateDoc,
} from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"

export type CatalogueNode = {
  id: string
  name: string
  path: string
  active?: boolean
  data: DocumentData
}

export type CatalogueItem = CatalogueNode & { options: CatalogueNode[] }
export type CatalogueSubcategory = CatalogueNode & { items: CatalogueItem[] }
export type CatalogueCategory = CatalogueNode & { subcategories: CatalogueSubcategory[] }

export type CoveragePincode = {
  code: number
  Active: boolean
  areaNames: string[]
}

export type CoverageHub = {
  id: string
  path: string
  hubName: string
  Active: boolean
  pincodes: CoveragePincode[]
}

export type CoverageCategory = {
  id: string
  path: string
  categoryId: string
  categoryName: string
  Active: boolean
  hubs: CoverageHub[]
}

export type CoverageCity = {
  id: string
  path: string
  cityName: string
  Active: boolean
  categories: CoverageCategory[]
}

const db = () => getFirestoreDb()

function referenceId(value: unknown): string | undefined {
  if (value instanceof DocumentReference) return value.id
  if (typeof value === "string") return value.split("/").filter(Boolean).pop()
  return undefined
}

function nodeName(data: DocumentData, fallback: string) {
  const candidates = [
    data.name,
    data.title,
    data.categoryName,
    data.subcategoryName,
    data.itemName,
    data.optionName,
    data.service_name,
  ]
  return candidates.find((value) => typeof value === "string" && value.trim())?.trim() || fallback
}

function nodeActive(data: DocumentData): boolean | undefined {
  if (typeof data.Active === "boolean") return data.Active
  if (typeof data.active === "boolean") return data.active
  if (typeof data.isActive === "boolean") return data.isActive
  return undefined
}

function relationId(data: DocumentData, fields: string[]) {
  for (const field of fields) {
    const id = referenceId(data[field])
    if (id) return id
  }
  return undefined
}

async function safeCollection(name: string) {
  try {
    return (await getDocs(collection(db(), name))).docs
  } catch (error) {
    console.warn(`[services] Could not read ${name}`, error)
    return []
  }
}

export async function fetchServiceCatalogue(): Promise<CatalogueCategory[]> {
  const [subDocs, itemDocs, optionDocs, packageDocs] = await Promise.all([
    safeCollection("service_subcategories"),
    safeCollection("service_SubCategoriesItems"),
    safeCollection("itemOptions"),
    safeCollection("service_packages"),
  ])

  // Follow real references first. This avoids guessing the case-sensitive category collection.
  const categoryRefs = new Map<string, DocumentReference>()
  for (const sub of subDocs) {
    const value = sub.data().service_category_id
    if (value instanceof DocumentReference) categoryRefs.set(value.path, value)
  }

  const referencedCategoryDocs = await Promise.all(
    [...categoryRefs.values()].map(async (ref) => {
      try {
        return await getDoc(ref)
      } catch {
        return null
      }
    }),
  )

  // These reads also surface categories that do not have a subcategory yet.
  const [upperCategories, lowerCategories] = await Promise.all([
    safeCollection("Service_Categories"),
    safeCollection("service_categories"),
  ])

  const categoryMap = new Map<string, CatalogueCategory>()
  for (const snapshot of [...referencedCategoryDocs.filter(Boolean), ...upperCategories, ...lowerCategories]) {
    if (!snapshot?.exists()) continue
    const data = snapshot.data()
    categoryMap.set(snapshot.id, {
      id: snapshot.id,
      name: nodeName(data, snapshot.id),
      path: snapshot.ref.path,
      active: nodeActive(data),
      data,
      subcategories: [],
    })
  }

  const uncategorized: CatalogueCategory = {
    id: "__uncategorized__",
    name: "Uncategorized",
    path: "",
    data: {},
    subcategories: [],
  }

  const subcategoryMap = new Map<string, CatalogueSubcategory>()
  for (const snapshot of subDocs) {
    const data = snapshot.data()
    const subcategory: CatalogueSubcategory = {
      id: snapshot.id,
      name: nodeName(data, snapshot.id),
      path: snapshot.ref.path,
      active: nodeActive(data),
      data,
      items: [],
    }
    subcategoryMap.set(snapshot.id, subcategory)
    const categoryId = relationId(data, ["service_category_id", "service_category", "category_id"])
    const category = (categoryId && categoryMap.get(categoryId)) || uncategorized
    category.subcategories.push(subcategory)
  }

  const itemMap = new Map<string, CatalogueItem>()
  for (const snapshot of itemDocs) {
    const data = snapshot.data()
    const item: CatalogueItem = {
      id: snapshot.id,
      name: nodeName(data, snapshot.id),
      path: snapshot.ref.path,
      active: nodeActive(data),
      data,
      options: [],
    }
    itemMap.set(snapshot.id, item)
    const subcategoryId = relationId(data, [
      "service_subcategory_id",
      "service_subCategory_id",
      "service_subcategory",
      "sub_category_id",
    ])
    subcategoryMap.get(subcategoryId || "")?.items.push(item)
  }

  for (const snapshot of [...optionDocs, ...packageDocs]) {
    const data = snapshot.data()
    const itemId = relationId(data, [
      "service_SubCategoriesItems_id",
      "service_subCategoriesItems_id",
      "service_subcategory_item_id",
      "subcategory_item_id",
      "service_item_id",
      "item_id",
      "item",
    ])
    const item = itemMap.get(itemId || "")
    if (!item) continue
    item.options.push({
      id: snapshot.id,
      name: nodeName(data, snapshot.id),
      path: snapshot.ref.path,
      active: nodeActive(data),
      data,
    })
  }

  if (uncategorized.subcategories.length) categoryMap.set(uncategorized.id, uncategorized)
  return [...categoryMap.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function parsePincode(value: unknown, inheritedActive: boolean): CoveragePincode[] {
  const values = Array.isArray(value) ? value : value == null ? [] : [value]
  const result: CoveragePincode[] = []
  for (const entry of values) {
    if (typeof entry === "number" || typeof entry === "string") {
      const code = Number(String(entry).match(/\d{6}/)?.[0])
      if (Number.isInteger(code)) result.push({ code, Active: inheritedActive, areaNames: [] })
      continue
    }
    if (!entry || typeof entry !== "object") continue
    const map = entry as Record<string, unknown>
    const code = Number(String(map.code ?? map.pincode ?? "").match(/\d{6}/)?.[0])
    if (!Number.isInteger(code)) continue
    const rawAreas = Array.isArray(map.areaNames) ? map.areaNames : []
    result.push({
      code,
      Active: map.Active === true,
      areaNames: rawAreas.filter((name): name is string => typeof name === "string" && Boolean(name.trim())),
    })
  }
  return result
}

export async function fetchCoverage(): Promise<CoverageCity[]> {
  const cities = await getDocs(collection(db(), "service_coverage"))
  return Promise.all(
    cities.docs.map(async (cityDoc) => {
      const cityData = cityDoc.data()
      const categories = await getDocs(collection(cityDoc.ref, "Categories"))
      const categoryRows = await Promise.all(
        categories.docs.map(async (categoryDoc) => {
          const categoryData = categoryDoc.data()
          const hubs = await getDocs(collection(categoryDoc.ref, "service_hubs"))
          return {
            id: categoryDoc.id,
            path: categoryDoc.ref.path,
            categoryId: referenceId(categoryData.categoryId) || categoryDoc.id,
            categoryName: categoryData.categoryName || categoryDoc.id,
            Active: categoryData.Active === true,
            hubs: hubs.docs.map((hubDoc) => {
              const data = hubDoc.data()
              const merged = [
                ...parsePincode(data.pincodes, data.Active === true),
                ...parsePincode(data.pincode, data.Active === true),
              ]
              const unique = new Map(merged.map((pin) => [pin.code, pin]))
              return {
                id: hubDoc.id,
                path: hubDoc.ref.path,
                hubName: data.hubName || hubDoc.id,
                Active: data.Active === true,
                pincodes: [...unique.values()].sort((a, b) => a.code - b.code),
              }
            }),
          }
        }),
      )
      return {
        id: cityDoc.id,
        path: cityDoc.ref.path,
        cityName: cityData.cityName || cityDoc.id,
        Active: cityData.Active === true,
        categories: categoryRows,
      }
    }),
  )
}

export async function saveCity(cityName: string) {
  if (!cityName.trim()) throw new Error("Enter a valid city name")
  await addDoc(collection(db(), "service_coverage"), { cityName: cityName.trim(), Active: true })
}

export async function assignCategory(cityId: string, category: CatalogueCategory) {
  if (!category.path) throw new Error("This category has no source document reference")
  await addDoc(collection(db(), "service_coverage", cityId, "Categories"), {
    categoryId: doc(db(), category.path),
    categoryName: category.name,
    Active: true,
  })
}

export async function saveHub(cityId: string, categoryId: string, hubName: string) {
  if (!hubName.trim()) throw new Error("Enter a valid hub name")
  await addDoc(collection(db(), "service_coverage", cityId, "Categories", categoryId, "service_hubs"), {
    hubName: hubName.trim(),
    Active: true,
    pincodes: [],
  })
}

export async function setActive(path: string, Active: boolean) {
  await updateDoc(doc(db(), path), { Active })
}

export async function renameCoverage(path: string, field: "cityName" | "hubName", value: string) {
  await updateDoc(doc(db(), path), { [field]: value.trim() })
}

export async function savePincodes(hubPath: string, pincodes: CoveragePincode[]) {
  await updateDoc(doc(db(), hubPath), { pincodes, pincode: deleteField() })
}

// Status changes must preserve the exact stored pincode field and object shape.
export async function setPincodeActive(hubPath: string, code: number, Active: boolean) {
  const hubRef = doc(db(), hubPath)

  await runTransaction(db(), async (transaction) => {
    const snapshot = await transaction.get(hubRef)
    if (!snapshot.exists()) throw new Error("The service hub no longer exists")

    const data = snapshot.data()
    const updates: Record<string, unknown> = {}
    let found = false

    for (const field of ["pincodes", "pincode"] as const) {
      const stored = data[field]
      if (Array.isArray(stored)) {
        let changed = false
        const next = stored.map((entry) => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry
          const map = entry as Record<string, unknown>
          const storedCode = Number(String(map.code ?? map.pincode ?? "").match(/\d{6}/)?.[0])
          if (storedCode !== code) return entry
          found = true
          changed = true
          return { ...map, Active }
        })
        if (changed) updates[field] = next
      } else if (stored && typeof stored === "object") {
        const map = stored as Record<string, unknown>
        const storedCode = Number(String(map.code ?? map.pincode ?? "").match(/\d{6}/)?.[0])
        if (storedCode === code) {
          found = true
          updates[field] = { ...map, Active }
        }
      }
    }

    if (!found) throw new Error(`Pincode ${code} was not found in the hub document`)
    transaction.update(hubRef, updates)
  })
}
