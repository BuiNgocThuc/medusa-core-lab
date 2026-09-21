import { Module } from "@medusajs/framework/utils";
import TierModuleService from "./service";

export const TIER_MODULE = "tier";

export default Module(TIER_MODULE, {
    service: TierModuleService,
});

export { default as TierModuleService } from "./service";
