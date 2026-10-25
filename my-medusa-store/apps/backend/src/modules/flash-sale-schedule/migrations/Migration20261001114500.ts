import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261001114500 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "flash_sale_schedule" add column if not exists "status" text check ("status" in ('active', 'inactive', 'scheduled')) not null default 'scheduled';`)
    this.addSql(`update "flash_sale_schedule" set "status" = case when "enabled" then 'active' else 'inactive' end where "status" = 'scheduled';`)
    this.addSql(`drop index if exists "IDX_flash_sale_schedule_enabled";`)
    this.addSql(`alter table if exists "flash_sale_schedule" drop column if exists "enabled";`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_flash_sale_schedule_status" ON "flash_sale_schedule" ("status") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "flash_sale_schedule" add column if not exists "enabled" boolean not null default true;`)
    this.addSql(`update "flash_sale_schedule" set "enabled" = "status" != 'inactive';`)
    this.addSql(`drop index if exists "IDX_flash_sale_schedule_status";`)
    this.addSql(`alter table if exists "flash_sale_schedule" drop column if exists "status";`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_flash_sale_schedule_enabled" ON "flash_sale_schedule" ("enabled") WHERE deleted_at IS NULL;`)
  }
}
