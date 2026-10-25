import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/** Upgrades the empty table left by the retired prototype without dropping it. */
export class Migration20260930050000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "conditional_promotion" add column if not exists "promo_id" text null, add column if not exists "title" text null, add column if not exists "description" text null, add column if not exists "terms" text null, add column if not exists "cta_url" text null, add column if not exists "rule_tree" jsonb null, add column if not exists "max_quantity" integer null, add column if not exists "placements" jsonb null;`)
    this.addSql(`create unique index if not exists "IDX_conditional_promotion_promo_id_unique" on "conditional_promotion" ("promo_id") where "deleted_at" is null;`)
  }
  override async down(): Promise<void> {}
}
