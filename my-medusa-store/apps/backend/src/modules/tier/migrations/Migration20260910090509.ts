import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260910090509 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "tier_rule" drop constraint if exists "tier_rule_tier_id_currency_code_unique";`);
    this.addSql(`drop index if exists "IDX_tier_rule_tier_id_currency_code";`);

    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tier_rule_tier_id_currency_code_unique" ON "tier_rule" ("tier_id", "currency_code") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_tier_rule_tier_id_currency_code_unique";`);

    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_tier_rule_tier_id_currency_code" ON "tier_rule" ("tier_id", "currency_code") WHERE deleted_at IS NULL;`);
  }

}
