import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261001091112 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "customer_identity_link" drop constraint if exists "customer_identity_link_auth_identity_id_unique";`);
    this.addSql(`create table if not exists "customer_identity_link" ("id" text not null, "customer_id" text not null, "auth_identity_id" text not null, "provider" text not null, "status" text check ("status" in ('ACTIVE', 'REVOKED')) not null default 'ACTIVE', "link_attempt_id" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "customer_identity_link_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "idx_customer_identity_link_customer_id" ON "customer_identity_link" ("customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_customer_identity_link_auth_identity_id_unique" ON "customer_identity_link" ("auth_identity_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "idx_customer_identity_link_attempt_id" ON "customer_identity_link" ("link_attempt_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_customer_identity_link_deleted_at" ON "customer_identity_link" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "customer_identity_link" cascade;`);
  }

}
