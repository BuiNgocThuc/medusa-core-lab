import { model } from "@medusajs/framework/utils"

export const LoyaltyTransaction = model
    .define("loyalty_transaction", {
        id: model.id().primaryKey(),
        customer_id: model.text(),
        type: model.text(),
        reference_id: model.text(),
        points: model.number(),
        status: model.text().default("completed"),
        cart_id: model.text().nullable(),
        order_id: model.text().nullable(),
        promotion_id: model.text().nullable(),
    })
    .indexes([
        {
            on: ["type", "reference_id"],
            unique: true,
        },
        {
            on: ["customer_id"],
        },
    ])
