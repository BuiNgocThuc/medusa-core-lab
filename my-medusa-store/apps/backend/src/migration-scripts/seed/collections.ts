import type { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export const COLLECTION_FIXTURES = [
  { title: "New Arrivals", handle: "new-arrivals" },
  { title: "Best Sellers", handle: "best-sellers" },
  { title: "Badminton Essentials", handle: "badminton-essentials" },
] as const

export async function seedCollections(container: MedusaContainer) {
  const productModule = container.resolve(Modules.PRODUCT) as any
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
  const collections: any[] = []

  for (const fixture of COLLECTION_FIXTURES) {
    const [existing] = await productModule.listProductCollections({
      handle: fixture.handle,
    })
    collections.push(
      existing ?? await productModule.createProductCollections(fixture)
    )
  }

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id"],
    pagination: { take: 1000, skip: 0 },
  })
  const collectionAssignments = [0, 1, 2]
  for (const [index, product] of products.entries()) {
    const collection = collections[collectionAssignments[index % collections.length]]
    await productModule.updateProducts({
      id: product.id,
      collection_id: collection.id,
    })
  }

  return collections
}
