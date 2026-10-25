import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260921042606 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "loyalty_transaction" drop constraint if exists "loyalty_transaction_order_id_type_unique";`);
    this.addSql(`alter table if exists "loyalty_reservation" drop constraint if exists "loyalty_reservation_cart_id_unique";`);
    this.addSql(`create table if not exists "loyalty_reservation" ("id" text not null, "customer_id" text not null, "cart_id" text not null, "promotion_id" text not null, "points" integer not null, "state" text not null default 'reserved', "expires_at" timestamptz not null, "order_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "loyalty_reservation_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_loyalty_reservation_cart_id_unique" ON "loyalty_reservation" ("cart_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_reservation_deleted_at" ON "loyalty_reservation" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_reservation_customer_id_state_expires_at" ON "loyalty_reservation" ("customer_id", "state", "expires_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_reservation_order_id" ON "loyalty_reservation" ("order_id") WHERE deleted_at IS NULL;`);

    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_loyalty_transaction_order_id_type_unique" ON "loyalty_transaction" ("order_id", "type") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "loyalty_reservation" cascade;`);

    this.addSql(`drop index if exists "IDX_loyalty_transaction_order_id_type_unique";`);
  }

}
