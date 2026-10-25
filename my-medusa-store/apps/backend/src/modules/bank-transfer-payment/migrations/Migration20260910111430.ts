import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260910111430 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "bank_transaction" drop constraint if exists "bank_transaction_external_transaction_id_unique";`);
    this.addSql(`alter table if exists "bank_payment_reference" drop constraint if exists "bank_payment_reference_payment_session_id_unique";`);
    this.addSql(`alter table if exists "bank_payment_reference" drop constraint if exists "bank_payment_reference_payment_reference_unique";`);
    this.addSql(`create table if not exists "bank_payment_reference" ("id" text not null, "payment_reference" text not null, "payment_session_id" text not null, "provider_id" text not null, "expected_amount" integer not null, "currency_code" text not null, "status" text check ("status" in ('pending', 'matched', 'underpaid', 'overpaid', 'expired', 'canceled', 'manual_review')) not null default 'pending', "expires_at" timestamptz not null, "matched_transaction_id" text null, "received_amount" integer null, "matched_at" timestamptz null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "bank_payment_reference_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_bank_payment_reference_payment_reference_unique" ON "bank_payment_reference" ("payment_reference") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_bank_payment_reference_payment_session_id_unique" ON "bank_payment_reference" ("payment_session_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_bank_payment_reference_provider_id" ON "bank_payment_reference" ("provider_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_bank_payment_reference_matched_transaction_id" ON "bank_payment_reference" ("matched_transaction_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_bank_payment_reference_deleted_at" ON "bank_payment_reference" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "bank_transaction" ("id" text not null, "external_transaction_id" text not null, "payment_reference" text null, "payment_session_id" text null, "amount" integer not null, "currency_code" text not null, "description" text null, "status" text check ("status" in ('matched', 'duplicate', 'underpaid', 'overpaid', 'unmatched', 'expired', 'failed', 'ignored')) not null default 'unmatched', "raw_payload" jsonb null, "received_at" timestamptz not null, "processed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "bank_transaction_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_bank_transaction_external_transaction_id_unique" ON "bank_transaction" ("external_transaction_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_bank_transaction_payment_reference" ON "bank_transaction" ("payment_reference") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_bank_transaction_payment_session_id" ON "bank_transaction" ("payment_session_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_bank_transaction_deleted_at" ON "bank_transaction" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "bank_webhook_event" ("id" text not null, "event_id" text null, "external_transaction_id" text null, "status" text check ("status" in ('received', 'processed', 'ignored', 'failed')) not null default 'received', "raw_payload" jsonb not null, "headers" jsonb null, "error_message" text null, "processed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "bank_webhook_event_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_bank_webhook_event_event_id" ON "bank_webhook_event" ("event_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_bank_webhook_event_external_transaction_id" ON "bank_webhook_event" ("external_transaction_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_bank_webhook_event_deleted_at" ON "bank_webhook_event" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "bank_payment_reference" cascade;`);

    this.addSql(`drop table if exists "bank_transaction" cascade;`);

    this.addSql(`drop table if exists "bank_webhook_event" cascade;`);
  }

}
