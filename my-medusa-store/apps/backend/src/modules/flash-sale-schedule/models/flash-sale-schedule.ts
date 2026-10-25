import { model } from "@medusajs/framework/utils";
import { InferTypeOf } from "@medusajs/framework/types";

export const FlashSaleSchedule = model
    .define("flash_sale_schedule", {
        id: model.id().primaryKey(),
        promo_id: model.text(),
        status: model.enum(["active", "inactive", "scheduled", "due"]).default("scheduled"),
        timezone: model.text().default("Asia/Ho_Chi_Minh"),
        start_time: model.text(),
        end_time: model.text(),
        weekdays: model.json(),
        max_discount_amount: model.number(),
    })
    .indexes([{ on: ["promo_id"], unique: true }, { on: ["status"] }]);

export type FlashSaleScheduleType = InferTypeOf<typeof FlashSaleSchedule>;
