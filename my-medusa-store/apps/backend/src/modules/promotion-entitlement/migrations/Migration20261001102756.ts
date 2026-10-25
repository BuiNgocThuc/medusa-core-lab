import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261001102756 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "flash_redemption" add column if not exists "flash_sale_schedule_id" text null, add column if not exists "source_promotion_id" text null, add column if not exists "campaign_id" text null, add column if not exists "carrier_promotion_id" text null, add column if not exists "expires_at" timestamptz null;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_flash_redemption_flash_sale_schedule_id_state_expires_at" ON "flash_redemption" ("flash_sale_schedule_id", "state", "expires_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_flash_redemption_flash_sale_schedule_id_state_expires_at";`);
    this.addSql(`alter table if exists "flash_redemption" drop column if exists "flash_sale_schedule_id", drop column if exists "source_promotion_id", drop column if exists "campaign_id", drop column if exists "carrier_promotion_id", drop column if exists "expires_at";`);
  }

}
