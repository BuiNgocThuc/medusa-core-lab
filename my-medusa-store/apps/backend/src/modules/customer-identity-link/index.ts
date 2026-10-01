import { Module } from "@medusajs/framework/utils";
import CustomerIdentityLinkService from "./service";

export const CUSTOMER_IDENTITY_LINK_MODULE = "customer_identity_link";

export default Module(CUSTOMER_IDENTITY_LINK_MODULE, {
  service: CustomerIdentityLinkService,
});

export { default as CustomerIdentityLinkService } from "./service";
export * from "./services/pending-link-session-service";
export * from "./models";
