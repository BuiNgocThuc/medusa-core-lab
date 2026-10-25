import { model } from "@medusajs/framework/utils"

export const FlashRedemption = model
    .define("flash_redemption", {
        id: model.id().primaryKey(),
        customer_id: model.text(),
        cart_id: model.text().nullable(),
        order_id: model.text().nullable(),
        flash_sale_schedule_id: model.text().nullable(),
        source_promotion_id: model.text().nullable(),
        campaign_id: model.text().nullable(),
        carrier_promotion_id: model.text().nullable(),
        state: model.text().default("reserved"),
        amount: model.number(),
        reserved_at: model.dateTime().nullable(),
        expires_at: model.dateTime().nullable(),
        consumed_at: model.dateTime().nullable(),
    })
    .indexes([
        { on: ["customer_id"] },
        { on: ["flash_sale_schedule_id", "state", "expires_at"] },
        { on: ["cart_id"], unique: true },
        { on: ["order_id"], unique: true },
    ])
