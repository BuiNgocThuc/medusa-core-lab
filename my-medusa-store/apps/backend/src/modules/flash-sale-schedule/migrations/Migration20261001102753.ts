import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261001102753 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "flash_sale_schedule" drop constraint if exists "flash_sale_schedule_promo_id_unique";`);
    this.addSql(`create table if not exists "flash_sale_schedule" ("id" text not null, "promo_id" text not null, "enabled" boolean not null default true, "timezone" text not null default 'Asia/Ho_Chi_Minh', "start_time" text not null, "end_time" text not null, "weekdays" jsonb not null, "max_discount_amount" integer not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "flash_sale_schedule_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_flash_sale_schedule_deleted_at" ON "flash_sale_schedule" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_flash_sale_schedule_promo_id_unique" ON "flash_sale_schedule" ("promo_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_flash_sale_schedule_enabled" ON "flash_sale_schedule" ("enabled") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "flash_sale_schedule" cascade;`);
  }

}
