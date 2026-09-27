/**
 * Seed Script: Tạo Shipping Option Type cho Giao Hàng Nhanh (GHN)
 *
 * Mục đích:
 *   Shipping Option Type chỉ có 2 chức năng trong Medusa:
 *   1. Phân loại / gom nhóm các Shipping Option có đặc điểm tương đồng
 *   2. Áp dụng Promotion cho cả nhóm cùng một lúc
 *      (VD: "Free shipping cho tất cả đơn dùng GHN Delivery")
 *
 * Cách chạy:
 *   npx medusa exec ./src/scripts/seed-ghn-shipping-option-type.ts
 *
 * Idempotent: Có thể chạy nhiều lần mà không tạo bản ghi trùng lặp.
 */
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export default async function seedGhnShippingOptionType({ container }: ExecArgs) {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any
    const fulfillmentModule = container.resolve(Modules.FULFILLMENT) as any

    logger.info("[seed:ghn-shipping-option-type] Starting...")

    // upsertShippingOptionTypes = create nếu chưa có, update nếu đã tồn tại → idempotent
    const result = await fulfillmentModule.upsertShippingOptionTypes([
        {
            /**
             * label: Tên hiển thị trong Admin UI
             *
             * Dùng cho mục đích phân loại và gom nhóm.
             * Admin có thể gán type này cho bất kỳ Shipping Option nào
             * để áp dụng promotion miễn phí vận chuyển cho toàn bộ nhóm GHN.
             *
             * VD: Promotion "FREE_SHIPPING_GHN" → target type = "GHN Delivery"
             *     → Tất cả shipping options thuộc type này được miễn phí
             */
            /**
             * code: Mã định danh kỹ thuật (unique slug), không thay đổi theo thời gian.
             * Dùng khi query hoặc gán type cho Shipping Option theo code.
             */
            code: "ghn-delivery",
            label: "GHN Delivery",
        },
    ])

    const created = Array.isArray(result) ? result : [result]

    for (const type of created) {
        logger.info(
            `[seed:ghn-shipping-option-type] ✓ Upserted — id=${type.id}, label="${type.label}"`
        )
    }

    logger.info(
        `[seed:ghn-shipping-option-type] Done — ${created.length} shipping option type(s) processed.`
    )
    logger.info(
        `[seed:ghn-shipping-option-type] Next step: Vào Admin → Settings → Locations & Shipping → chọn Shipping Option → gán type "GHN Delivery"`
    )
}
