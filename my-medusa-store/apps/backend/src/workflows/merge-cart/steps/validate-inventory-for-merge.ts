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

/**
 * Helper: Chuẩn hóa dữ liệu từ Remote Query về dạng mảng
 * (Medusa đôi khi trả về Array, đôi khi trả về Object đơn lẻ hoặc null)
 */
function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value
  if (value) return [value]
  return []
}

/**
 * Helper: Lọc ra các location_id hợp lệ cho sales channel hiện tại
 */
function getLocationIdsForSalesChannel(
  locationLevels: any[],
  salesChannelId?: string | null
): string[] {
  if (!salesChannelId) {
    // Không có sales channel → lấy tất cả kho
    return locationLevels.map((lvl: any) => lvl.location_id)
  }

  return locationLevels
    .filter((lvl: any) => {
      const stockLocations = toArray(lvl.stock_locations)
      return stockLocations.some((loc: any) => {
        const salesChannels = toArray(loc.sales_channels)
        return salesChannels.some((sc: any) => sc.id === salesChannelId)
      })
    })
    .map((lvl: any) => lvl.location_id)
}

/**
 * Phương án E: Smart Partial Merge
 *
 * Thay vì skip hẳn variant khi tổng quantity vượt stock (Phương án A cũ),
 * step này sẽ tính toán "maxAddableQty" — số lượng tối đa từ Guest Cart
 * có thể thêm vào Customer Cart mà không vượt quá tồn kho.
 *
 * Kết quả có 3 trường hợp cho mỗi variant:
 * 1. Đủ hàng hoàn toàn → valid_items (giữ nguyên quantity)
 * 2. Đủ hàng 1 phần → valid_items (quantity đã giảm) + skipped_items (có adjusted_quantity)
 * 3. Hết hàng hoàn toàn → skipped_items (adjusted_quantity = undefined)
 */
export const validateInventoryForMergeStep = createStep(
  "validate-inventory-for-merge",
  async (input: ValidateInventoryForMergeInput, { container }) => {

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
    // lấy ra key value với key là 
    // variant_id và value là số lượng của variant đó trong cart A 


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
    console.log("variant", variants)
    const variantMap = new Map<string, any>((variants || []).map((v: any) => [v.id, v]))

    // 4. Validate each variant — Smart Partial Merge
    // variantResult chứa kết quả cho từng variant: full (đủ hết), partial (đủ 1 phần), hoặc none (hết sạch)
    const variantResult = new Map<
      string,
      { status: "full" | "partial" | "none"; maxAddableQty?: number; reason?: string }
    >()

    for (const variantId of variantIds) {
      const variant = variantMap.get(variantId)
      const existingQty = existingQtyMap.get(variantId) ?? 0
      const guestQty = guestQtyMap.get(variantId) ?? 0
      const totalNeeded = Number(MathBN.add(existingQty, guestQty))

      // --- Các trường hợp đặc biệt: Luôn cho phép thêm hết ---

      if (!variant) {
        variantResult.set(variantId, { status: "none", reason: "VARIANT_NOT_FOUND" })
        continue
      }

      // Sản phẩm không quản lý tồn kho (VD: sản phẩm số, dịch vụ)
      if (!variant.manage_inventory) {
        variantResult.set(variantId, { status: "full" })
        continue
      }

      // Cho phép đặt hàng khi hết stock
      if (variant.allow_backorder) {
        variantResult.set(variantId, { status: "full" })
        continue
      }

      const inventoryItems = variant.inventory_items ?? []
      if (inventoryItems.length === 0) {
        variantResult.set(variantId, { status: "none", reason: "NO_INVENTORY_ITEMS" })
        continue
      }

      // --- Tính toán maxAddableQty cho variant này ---
      // Logic: Duyệt qua từng inventory item (linh kiện kho) cấu thành variant.
      // Với mỗi linh kiện, tìm số lượng khả dụng (available) trong các kho hợp lệ.
      // Từ đó tính ra: Mỗi linh kiện cho phép bán tối đa bao nhiêu "sản phẩm variant"?
      // maxAddableQty = min(cho phép theo linh kiện A, theo linh kiện B, ...) - existingQty trong cart
      // Chính là "bottleneck" (linh kiện ít nhất sẽ giới hạn cả combo).

      let variantMaxSellable = Infinity // Số lượng variant tối đa có thể bán (dựa trên TẤT CẢ linh kiện)
      let hasLocationIssue = false

      for (const invItem of inventoryItems) {
        const locationLevels = invItem.inventory?.location_levels ?? []
        const locationIds = getLocationIdsForSalesChannel(locationLevels, input.sales_channel_id)

        if (locationIds.length === 0) {
          console.log(
            `[Step: validate-inventory-for-merge] Variant ${variantId} has no location for sales channel ${input.sales_channel_id}`
          )
          hasLocationIssue = true
          variantMaxSellable = 0
          break
        }

        const requiredQty = invItem.required_quantity ?? 1

        // Lấy số lượng thực sự còn trong kho (stocked - reserved)
        const availableQty = await inventoryService.retrieveAvailableQuantity(
          invItem.inventory_item_id,
          locationIds
        )

        // Tính: Với lượng available này, linh kiện này cho phép bán tối đa bao nhiêu sản phẩm?
        // VD: available = 8, requiredQty = 4 (ghế trong combo bàn ăn) → maxUnitsFromThisItem = 8 / 4 = 2 bộ
        const maxUnitsFromThisItem = Math.floor(Number(availableQty) / requiredQty)

        console.log(
          `[Step: validate-inventory-for-merge] Variant ${variantId} (item ${invItem.inventory_item_id}): ` +
          `available=${availableQty}, requiredQty=${requiredQty}, maxUnits=${maxUnitsFromThisItem}, ` +
          `existingInCart=${existingQty}, guestWants=${guestQty}`
        )

        // Cập nhật bottleneck, quantity của variant của shop tối đa có thể bán
        variantMaxSellable = Math.min(variantMaxSellable, maxUnitsFromThisItem)
      }

      if (hasLocationIssue || variantMaxSellable <= 0) {
        // Kho không hỗ trợ kênh bán này hoặc đã hết hàng hoàn toàn
        variantResult.set(variantId, {
          status: "none",
          reason: existingQty > 0 ? "EXCEEDS_AVAILABLE_STOCK" : "OUT_OF_STOCK",
        })
        continue
      }

      // maxAddableQty = Số lượng kho cho phép bán tổng cộng - Số lượng đã có sẵn trong Cart A
      // VD: Kho cho phép bán 3, Cart A đã có 2 → chỉ được thêm tối đa 1 cái nữa
      const maxAddableQty = Math.max(0, variantMaxSellable - existingQty)

      if (maxAddableQty <= 0) {
        // Cart A đã chiếm hết stock rồi, không thể thêm gì từ Guest Cart
        variantResult.set(variantId, {
          status: "none",
          reason: "EXCEEDS_AVAILABLE_STOCK",
        })
      } else if (maxAddableQty >= guestQty) {
        // Đủ stock cho toàn bộ số lượng Guest muốn thêm
        variantResult.set(variantId, { status: "full" })
      } else {
        // Chỉ đủ 1 phần → Partial Merge!
        // VD: Guest muốn thêm 3, nhưng chỉ thêm được 1
        variantResult.set(variantId, {
          status: "partial",
          maxAddableQty,
          reason: "PARTIAL_STOCK",
        })
      }
    }

    // 5. Phân loại guest items thành valid_items và skipped_items
    const valid_items: ValidateInventoryForMergeOutput["valid_items"] = []
    const skipped_items: SkippedCartItem[] = []

    // Vì có thể Guest Cart chứa nhiều dòng cùng 1 variant_id,
    // ta cần track còn bao nhiêu "quota" cho variant đó khi duyệt từng dòng.
    const remainingQuota = new Map<string, number>()
    for (const [variantId, result] of variantResult) {
      if (result.status === "full") {
        remainingQuota.set(variantId, Infinity)
      } else if (result.status === "partial") {
        remainingQuota.set(variantId, result.maxAddableQty!)
      } else {
        remainingQuota.set(variantId, 0)
      }
    }

    for (const item of input.guest_items) {
      const result = variantResult.get(item.variant_id)
      const quota = remainingQuota.get(item.variant_id) ?? 0
      const variant = variantMap.get(item.variant_id)

      if (result?.status === "full") {
        // Đủ hàng hoàn toàn → thêm nguyên vẹn
        valid_items.push({
          variant_id: item.variant_id,
          quantity: item.quantity,
          metadata: item.metadata,
        })
      } else if (result?.status === "partial" && quota > 0) {
        // Còn quota → thêm được 1 phần hoặc toàn bộ dòng này

        const addableForThisLine = Math.min(item.quantity, quota)
        remainingQuota.set(item.variant_id, quota - addableForThisLine)

        if (addableForThisLine === item.quantity) {
          // Dòng này vẫn được thêm đủ (nhưng tổng variant vẫn bị partial)
          valid_items.push({
            variant_id: item.variant_id,
            quantity: item.quantity,
            metadata: item.metadata,
          })
        } else {
          // Dòng này bị cắt bớt quantity
          valid_items.push({
            variant_id: item.variant_id,
            quantity: addableForThisLine,
            metadata: item.metadata,
          })

          // Thông báo phần bị cắt
          const title = item.title || item.product_title || variant?.product?.title || "Sản phẩm"
          const variant_title =
            item.variant_title || (variant?.title === "Default" ? undefined : variant?.title)

          skipped_items.push({
            variant_id: item.variant_id,
            title,
            variant_title,
            quantity: item.quantity,
            reason: "PARTIAL_STOCK",
            adjusted_quantity: addableForThisLine,
          })
        }
      } else {
        // status === "none" hoặc quota đã hết → skip hoàn toàn
        const title = item.title || item.product_title || variant?.product?.title || "Sản phẩm"
        const variant_title =
          item.variant_title || (variant?.title === "Default" ? undefined : variant?.title)

        skipped_items.push({
          variant_id: item.variant_id,
          title,
          variant_title,
          quantity: item.quantity,
          reason: result?.reason ?? "INSUFFICIENT_INVENTORY",
        })
      }
    }

    console.log(
      `[Step: validate-inventory-for-merge] Validation completed (Plan E). ` +
      `Valid: ${valid_items.length}, Skipped: ${skipped_items.length}, ` +
      `Partial: ${skipped_items.filter(s => s.adjusted_quantity !== undefined).length}`
    )

    return new StepResponse<ValidateInventoryForMergeOutput>({
      valid_items,
      skipped_items,
    })
  }
)
