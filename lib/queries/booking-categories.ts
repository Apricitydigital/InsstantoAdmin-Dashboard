import { DocumentReference, getDoc, type DocumentData } from "firebase/firestore"

const categoryNameCache = new Map<string, Promise<string | null>>()

const firstString = (...values: unknown[]) =>
  values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim() || null

const asReference = (value: unknown): DocumentReference<DocumentData> | null =>
  value && typeof value === "object" && "path" in value
    ? value as DocumentReference<DocumentData>
    : null

const inlineCategoryName = (data: DocumentData) => firstString(
  data.categoryName,
  data.category_name,
  data.serviceCategoryName,
  data.service_category_name
)

async function resolveReferenceName(
  reference: DocumentReference<DocumentData>,
  depth = 0
): Promise<string | null> {
  const cached = categoryNameCache.get(reference.path)
  if (cached) return cached

  const request = getDoc(reference)
    .then(async (snapshot) => {
      if (!snapshot.exists()) return null
      const data = snapshot.data()
      const inline = inlineCategoryName(data)
      if (inline) return inline

      if (depth < 2) {
        const parentReference = asReference(
          data.service_category_id || data.service_category || data.category_id
        )
        if (parentReference && parentReference.path !== reference.path) {
          const parentName = await resolveReferenceName(parentReference, depth + 1)
          if (parentName) return parentName
        }
      }

      return firstString(data.name, data.title)
    })
    .catch(() => null)

  categoryNameCache.set(reference.path, request)
  return request
}

export function inferServiceCategory(serviceName?: string): string | null {
  const name = serviceName?.trim().toLowerCase() || ""
  if (name.includes("maid")) return "Maid"
  if (name.includes("clean")) return "Cleaning"
  if (name.includes("electric") || name.includes("elec")) return "Electrical"
  if (name.includes("security")) return "Security"
  if (name.includes("driver")) return "Driver"
  return null
}

export async function resolveCartServiceCategory(
  cartData: DocumentData
): Promise<string | null> {
  const inline = inlineCategoryName(cartData)
  if (inline) return inline

  const directCategoryReference = asReference(
    cartData.service_category_id || cartData.service_category || cartData.category_id
  )
  if (directCategoryReference) {
    const categoryName = await resolveReferenceName(directCategoryReference)
    if (categoryName) return categoryName
  }

  const subcategoryReference = asReference(cartData.service_subCategory)
  if (subcategoryReference) {
    const categoryName = await resolveReferenceName(subcategoryReference)
    if (categoryName) return categoryName
  }

  return inferServiceCategory(firstString(cartData.service_name, cartData.serviceName) || undefined)
}
