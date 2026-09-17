import { model } from "@medusajs/framework/utils"

export const FirstPurchaseEntitlement = model
    .define("first_purchase_entitlement", {
        id: model.id().primaryKey(),
        customer_id: model.text().unique(),
        state: model.text().default("available"),
        cart_id: model.text().nullable(),
        order_id: model.text().nullable(),
        reserved_at: model.dateTime().nullable(),
        consumed_at: model.dateTime().nullable(),
    })
    .indexes([
        {
            on: ["cart_id"],
        },
        {
            on: ["order_id"],
            unique: true,
        },
    ])
