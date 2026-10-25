import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260917110052 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "flash_redemption" drop constraint if exists "flash_redemption_order_id_unique";`);
    this.addSql(`alter table if exists "flash_redemption" drop constraint if exists "flash_redemption_cart_id_unique";`);
    this.addSql(`create table if not exists "flash_redemption" ("id" text not null, "customer_id" text not null, "cart_id" text null, "order_id" text null, "state" text not null default 'reserved', "amount" integer not null, "reserved_at" timestamptz null, "consumed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "flash_redemption_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_flash_redemption_deleted_at" ON "flash_redemption" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_flash_redemption_customer_id" ON "flash_redemption" ("customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_flash_redemption_cart_id_unique" ON "flash_redemption" ("cart_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_flash_redemption_order_id_unique" ON "flash_redemption" ("order_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "flash_redemption" cascade;`);
  }

}
