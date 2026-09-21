import { model } from "@medusajs/framework/utils"

export const LoyaltyReservation = model
    .define("loyalty_reservation", {
        id: model.id().primaryKey(),
        customer_id: model.text(),
        cart_id: model.text().unique(),
        promotion_id: model.text(),
        points: model.number(),
        state: model.text().default("reserved"),
        expires_at: model.dateTime(),
        order_id: model.text().nullable(),
    })
    .indexes([
        { on: ["customer_id", "state", "expires_at"] },
        { on: ["order_id"] },
    ])
