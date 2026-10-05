import { defineLink } from "@medusajs/framework/utils";
import CustomerModule from "@medusajs/medusa/customer";
import LoyaltyModule from "../modules/loyalty"

export default defineLink(
  CustomerModule.linkable.customer,
  LoyaltyModule.linkable.loyaltyAccount
);