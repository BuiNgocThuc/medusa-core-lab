import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260930035142 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "conditional_promotion" drop constraint if exists "conditional_promotion_promo_id_unique";`);
    this.addSql(`create table if not exists "conditional_promotion" ("id" text not null, "promo_id" text not null, "title" text not null, "description" text null, "terms" text null, "cta_url" text null, "status" text check ("status" in ('active', 'inactive')) not null default 'inactive', "priority" integer not null default 0, "rule_tree" jsonb not null, "target" jsonb not null, "max_quantity" integer not null, "placements" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "conditional_promotion_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_conditional_promotion_deleted_at" ON "conditional_promotion" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_conditional_promotion_promo_id_unique" ON "conditional_promotion" ("promo_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_conditional_promotion_status" ON "conditional_promotion" ("status") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "conditional_promotion" cascade;`);
  }

}
