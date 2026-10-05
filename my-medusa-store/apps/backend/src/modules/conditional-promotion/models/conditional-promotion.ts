import { model } from "@medusajs/framework/utils";

export const ConditionalPromotion = model
    .define("conditional_promotion", {
        id: model.id().primaryKey(),
        promo_id: model.text(),
        title: model.text(),
        description: model.text().nullable(),
        terms: model.text().nullable(),
        cta_url: model.text().nullable(),
        status: model.enum(["active", "inactive"]).default("inactive"),
        priority: model.number().default(0),
        rule_tree: model.json(),
        target: model.json(),
        max_quantity: model.number(),
        placements: model.json().nullable(),
    })
    .indexes([{ on: ["promo_id"], unique: true }, { on: ["status"] }]);
