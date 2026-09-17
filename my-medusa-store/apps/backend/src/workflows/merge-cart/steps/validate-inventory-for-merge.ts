import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, Modules, MathBN } from "@medusajs/framework/utils"
import { SkippedCartItem } from "../types"

export type ValidateInventoryForMergeInput = {
  sales_channel_id?: string | null
  guest_items: {
    id?: string
    variant_id: string
    quantity: number
    title?: string
    variant_title?: string | null
    product_title?: string | null
    metadata?: Record<string, unknown>
  }[]
  existing_items: {
    id?: string
    variant_id?: string | null
    quantity: number
    title?: string
    variant_title?: string | null
  }[]
}

export type ValidateInventoryForMergeOutput = {
  valid_items: {
    variant_id: string
    quantity: number
    metadata?: Record<string, unknown>
  }[]
  skipped_items: SkippedCartItem[]
}

export const validateInventoryForMergeStep = createStep(
  "validate-inventory-for-merge",
  async (input: ValidateInventoryForMergeInput, { container }) => {
    console.log("[Step: validate-inventory-for-merge] Starting validation...")
    console.log(`[Step: validate-inventory-for-merge] guest_items count: ${input.guest_items?.length ?? 0}`)
    console.log(`[Step: validate-inventory-for-merge] existing_items count: ${input.existing_items?.length ?? 0}`)
    console.log(`[Step: validate-inventory-for-merge] sales_channel_id: ${input.sales_channel_id}`)

    if (!input.guest_items || input.guest_items.length === 0) {
      return new StepResponse<ValidateInventoryForMergeOutput>({
        valid_items: [],
        skipped_items: [],
      })
    }

    const query = container.resolve<any>(ContainerRegistrationKeys.QUERY)
    const inventoryService = container.resolve<any>(Modules.INVENTORY)

    // 1. Map existing quantity in Cart A by variant_id
    const existingQtyMap = new Map<string, number>()
    for (const item of input.existing_items ?? []) {
      if (item.variant_id) {
        const curr = existingQtyMap.get(item.variant_id) ?? 0
        existingQtyMap.set(item.variant_id, Number(MathBN.add(curr, item.quantity)))
      }
    }

    // 2. Map guest quantity by variant_id (aggregate multiple lines if any)
    const guestQtyMap = new Map<string, number>()
    for (const item of input.guest_items) {
      const curr = guestQtyMap.get(item.variant_id) ?? 0
      guestQtyMap.set(item.variant_id, Number(MathBN.add(curr, item.quantity)))
    }

    // 3. Query variant and inventory information
    const variantIds = Array.from(guestQtyMap.keys())
    const { data: variants } = await query.graph({
      entity: "variant",
      fields: [
        "id",
        "title",
        "product.title",
        "manage_inventory",
        "allow_backorder",
        "inventory_items.inventory_item_id",
        "inventory_items.required_quantity",
        "inventory_items.inventory.location_levels.location_id",
        "inventory_items.inventory.location_levels.stock_locations.id",
        "inventory_items.inventory.location_levels.stock_locations.sales_channels.id",
      ],
      filters: {
        id: variantIds,
      },
    })

    const variantMap = new Map<string, any>((variants || []).map((v: any) => [v.id, v]))

    // 4. Validate each variant against combined quantity (Cart A + Cart B)
    const variantValidity = new Map<string, { isValid: boolean; reason?: string }>()

    for (const variantId of variantIds) {
      const variant = variantMap.get(variantId)
      const existingQty = existingQtyMap.get(variantId) ?? 0
      const guestQty = guestQtyMap.get(variantId) ?? 0
      const totalNeeded = Number(MathBN.add(existingQty, guestQty))

      if (!variant) {
        variantValidity.set(variantId, { isValid: false, reason: "VARIANT_NOT_FOUND" })
        continue
      }

      // If inventory is not managed, item is always available
      if (!variant.manage_inventory) {
        variantValidity.set(variantId, { isValid: true })
        continue
      }

      // If backorder is allowed, item is always available
      if (variant.allow_backorder) {
        variantValidity.set(variantId, { isValid: true })
        continue
      }

      const inventoryItems = variant.inventory_items ?? []
      if (inventoryItems.length === 0) {
        // Managed inventory without inventory item records cannot be fulfilled
        variantValidity.set(variantId, { isValid: false, reason: "NO_INVENTORY_ITEMS" })
        continue
      }

      let allCovered = true
      for (const invItem of inventoryItems) {
        const locationLevels = invItem.inventory?.location_levels ?? []

        // Filter location IDs associated with the target sales channel
        let locationIds: string[] = []
        if (input.sales_channel_id) {
          locationIds = locationLevels
            .filter((lvl: any) => {
              const stockLocations = Array.isArray(lvl.stock_locations)
                ? lvl.stock_locations
                : lvl.stock_locations
                ? [lvl.stock_locations]
                : []
              return stockLocations.some((loc: any) => {
                const salesChannels = Array.isArray(loc.sales_channels)
                  ? loc.sales_channels
                  : loc.sales_channels
                  ? [loc.sales_channels]
                  : []
                return salesChannels.some((sc: any) => sc.id === input.sales_channel_id)
              })
            })
            .map((lvl: any) => lvl.location_id)
        } else {
          locationIds = locationLevels.map((lvl: any) => lvl.location_id)
        }

        if (locationIds.length === 0) {
          console.log(
            `[Step: validate-inventory-for-merge] Variant ${variantId} has no location for sales channel ${input.sales_channel_id}`
          )
          allCovered = false
          break
        }

        const requiredQty = invItem.required_quantity ?? 1
        const itemTotalNeeded = MathBN.mult(totalNeeded, requiredQty)

        const hasCoverage = await inventoryService.confirmInventory(
          invItem.inventory_item_id,
          locationIds,
          itemTotalNeeded
        )

        console.log(
          `[Step: validate-inventory-for-merge] Variant ${variantId} (item ${invItem.inventory_item_id}): needed=${itemTotalNeeded} (existing=${existingQty}, guest=${guestQty}), hasCoverage=${hasCoverage}`
        )

        if (!hasCoverage) {
          allCovered = false
          break
        }
      }

      if (allCovered) {
        variantValidity.set(variantId, { isValid: true })
      } else {
        const reason = existingQty > 0 ? "EXCEEDS_AVAILABLE_STOCK" : "OUT_OF_STOCK"
        variantValidity.set(variantId, { isValid: false, reason })
      }
    }

    // 5. Separate guest items into valid_items and skipped_items
    const valid_items: ValidateInventoryForMergeOutput["valid_items"] = []
    const skipped_items: SkippedCartItem[] = []

    for (const item of input.guest_items) {
      const status = variantValidity.get(item.variant_id)
      if (status?.isValid) {
        valid_items.push({
          variant_id: item.variant_id,
          quantity: item.quantity,
          metadata: item.metadata,
        })
      } else {
        const variant = variantMap.get(item.variant_id)
        const title = item.title || item.product_title || variant?.product?.title || "Sản phẩm"
        const variant_title =
          item.variant_title || (variant?.title === "Default" ? undefined : variant?.title)

        skipped_items.push({
          variant_id: item.variant_id,
          title,
          variant_title,
          quantity: item.quantity,
          reason: status?.reason ?? "INSUFFICIENT_INVENTORY",
        })
      }
    }

    console.log(
      `[Step: validate-inventory-for-merge] Validation completed. Valid: ${valid_items.length}, Skipped: ${skipped_items.length}`
    )

    return new StepResponse<ValidateInventoryForMergeOutput>({
      valid_items,
      skipped_items,
    })
  }
)
