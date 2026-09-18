import { MedusaService } from "@medusajs/framework/utils";
import { LoyaltyAccount } from "./models/loyalty-account";

export default class LoyaltyModuleService extends MedusaService({
  LoyaltyAccount
}) {}