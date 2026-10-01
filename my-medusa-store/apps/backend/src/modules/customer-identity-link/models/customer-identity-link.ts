import { model } from "@medusajs/framework/utils";

export enum IdentityLinkStatus {
    ACTIVE = "ACTIVE",
    REVOKED = "REVOKED",
}

export const CustomerIdentityLink = model.define("customer_identity_link", {
    id: model.id({ prefix: "cil" }).primaryKey(),
    customer_id: model.text().index("idx_customer_identity_link_customer_id"),
    auth_identity_id: model.text().unique(),
    provider: model.text(),
    status: model.enum(Object.values(IdentityLinkStatus)).default(IdentityLinkStatus.ACTIVE),
    link_attempt_id: model.text().index("idx_customer_identity_link_attempt_id").nullable(),
    metadata: model.json().nullable(),
});
