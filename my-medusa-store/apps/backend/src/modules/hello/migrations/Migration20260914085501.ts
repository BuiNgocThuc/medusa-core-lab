import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260914085501 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "custom" ("id" text not null, "custom_name" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "custom_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_custom_deleted_at" ON "custom" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "custom" cascade;`);
  }

}
