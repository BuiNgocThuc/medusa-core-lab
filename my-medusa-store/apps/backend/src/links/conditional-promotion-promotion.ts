import { defineLink } from "@medusajs/framework/utils";
import ConditionalPromotionModule from "../modules/conditional-promotion";
import PromotionModule from "@medusajs/medusa/promotion";

export default defineLink(
    { linkable: ConditionalPromotionModule.linkable.conditionalPromotion, field: "promo_id" },
    PromotionModule.linkable.promotion,
    { readOnly: true },
);
