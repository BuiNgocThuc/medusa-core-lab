import { registerCompleteCartPromotionValidation } from "./complete-cart";
import { registerUpdateCartPromotionValidation } from "./update-cart-promotions";

registerCompleteCartPromotionValidation();
registerUpdateCartPromotionValidation();

import "./shipping-pricing-context";
import "./sync-calculated-shipping";
