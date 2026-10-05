import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261002120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "flash_sale_schedule" drop constraint if exists "flash_sale_schedule_status_check";`)
    this.addSql(`alter table if exists "flash_sale_schedule" add constraint "flash_sale_schedule_status_check" check ("status" in ('active', 'inactive', 'scheduled', 'due'));`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "flash_sale_schedule" drop constraint if exists "flash_sale_schedule_status_check";`)
    this.addSql(`alter table if exists "flash_sale_schedule" add constraint "flash_sale_schedule_status_check" check ("status" in ('active', 'inactive', 'scheduled'));`)
  }
}
