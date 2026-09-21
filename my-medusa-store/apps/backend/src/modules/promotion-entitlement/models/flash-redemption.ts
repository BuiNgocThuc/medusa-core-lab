import { model } from "@medusajs/framework/utils"

export const FlashRedemption = model
    .define("flash_redemption", {
        id: model.id().primaryKey(),
        customer_id: model.text(),
        cart_id: model.text().nullable(),
        order_id: model.text().nullable(),
        state: model.text().default("reserved"),
        amount: model.number(),
        reserved_at: model.dateTime().nullable(),
        consumed_at: model.dateTime().nullable(),
    })
    .indexes([
        { on: ["customer_id"] },
        { on: ["cart_id"], unique: true },
        { on: ["order_id"], unique: true },
    ])
