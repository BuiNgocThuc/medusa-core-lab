import type { MedusaContainer } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

export const CUSTOMER_GROUP_FIXTURES = [
  "Retail",
  "VIP",
  "Wholesale",
] as const

export async function seedCustomerGroups(container: MedusaContainer) {
  const customerModule = container.resolve(Modules.CUSTOMER) as any
  const groups: any[] = []

  for (const name of CUSTOMER_GROUP_FIXTURES) {
    const [existing] = await customerModule.listCustomerGroups({ name })
    groups.push(existing ?? await customerModule.createCustomerGroups({ name }))
  }

  return groups
}
