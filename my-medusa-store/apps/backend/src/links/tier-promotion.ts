import { defineLink } from "@medusajs/framework/utils";
import TierModule from "@/src/modules/tier";
import PromotionModule from "@medusajs/medusa/promotion";

export default defineLink(
    {
        linkable: TierModule.linkable.tier,
        field: "promo_id",
    },
    PromotionModule.linkable.promotion,
    {
        readOnly: true,
    },
);
