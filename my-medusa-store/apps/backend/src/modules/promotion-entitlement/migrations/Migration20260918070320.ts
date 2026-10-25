import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260918070320 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`drop table if exists "first_purchase_entitlement" cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`create table if not exists "first_purchase_entitlement" ("id" text not null, "customer_id" text not null, "state" text not null default 'available', "cart_id" text null, "order_id" text null, "reserved_at" timestamptz null, "consumed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "first_purchase_entitlement_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_first_purchase_entitlement_customer_id_unique" ON "first_purchase_entitlement" ("customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_first_purchase_entitlement_deleted_at" ON "first_purchase_entitlement" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_first_purchase_entitlement_cart_id" ON "first_purchase_entitlement" ("cart_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_first_purchase_entitlement_order_id_unique" ON "first_purchase_entitlement" ("order_id") WHERE deleted_at IS NULL;`);
  }

}
