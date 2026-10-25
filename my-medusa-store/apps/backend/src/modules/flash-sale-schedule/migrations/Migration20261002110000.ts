import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261002110000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "flash_sale_schedule" drop column if exists "max_claims";`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "flash_sale_schedule" add column if not exists "max_claims" integer not null default 1;`)
  }
}
