import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260915120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "momo_payment" ("id" text not null, "payment_session_id" text not null, "cart_id" text null, "order_id" text null, "provider_id" text not null, "momo_order_id" text not null, "request_id" text not null, "amount" integer not null, "currency_code" text not null, "status" text check ("status" in ('initiated', 'pending', 'authorized', 'paid', 'failed', 'canceled', 'expired', 'refunded', 'partially_refunded', 'manual_review')) not null default 'initiated', "result_code" integer null, "message" text null, "trans_id" text null, "pay_type" text null, "payment_option" text null, "order_type" text null, "user_fee" integer null, "pay_url" text null, "short_link" text null, "deeplink" text null, "qr_code_url" text null, "deeplink_mini_app" text null, "raw_create_request" jsonb null, "raw_create_response" jsonb null, "paid_at" timestamptz null, "expires_at" timestamptz null, "last_queried_at" timestamptz null, "query_count" integer not null default 0, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "momo_payment_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_momo_payment_payment_session_id_unique" ON "momo_payment" ("payment_session_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_momo_payment_momo_order_id_unique" ON "momo_payment" ("momo_order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_momo_payment_request_id_unique" ON "momo_payment" ("request_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_momo_payment_trans_id_unique" ON "momo_payment" ("trans_id") WHERE trans_id IS NOT NULL AND deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_momo_payment_cart_id" ON "momo_payment" ("cart_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_momo_payment_order_id" ON "momo_payment" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_momo_payment_provider_id" ON "momo_payment" ("provider_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_momo_payment_deleted_at" ON "momo_payment" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "momo_webhook_event" ("id" text not null, "momo_payment_id" text null, "event_key" text not null, "order_id" text null, "request_id" text null, "trans_id" text null, "result_code" integer null, "signature_valid" boolean not null default false, "processing_status" text check ("processing_status" in ('received', 'processed', 'duplicate', 'ignored', 'failed')) not null default 'received', "raw_payload" jsonb not null, "error_message" text null, "processed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "momo_webhook_event_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_momo_webhook_event_event_key_unique" ON "momo_webhook_event" ("event_key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_momo_webhook_event_momo_payment_id" ON "momo_webhook_event" ("momo_payment_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_momo_webhook_event_order_id" ON "momo_webhook_event" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_momo_webhook_event_request_id" ON "momo_webhook_event" ("request_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_momo_webhook_event_trans_id" ON "momo_webhook_event" ("trans_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_momo_webhook_event_deleted_at" ON "momo_webhook_event" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "momo_refund" ("id" text not null, "momo_payment_id" text not null, "payment_id" text null, "refund_order_id" text not null, "request_id" text not null, "amount" integer not null, "status" text check ("status" in ('pending', 'succeeded', 'failed', 'manual_review')) not null default 'pending', "result_code" integer null, "message" text null, "refund_trans_id" text null, "raw_request" jsonb null, "raw_response" jsonb null, "processed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "momo_refund_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_momo_refund_refund_order_id_unique" ON "momo_refund" ("refund_order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_momo_refund_request_id_unique" ON "momo_refund" ("request_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_momo_refund_momo_payment_id" ON "momo_refund" ("momo_payment_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_momo_refund_payment_id" ON "momo_refund" ("payment_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_momo_refund_refund_trans_id" ON "momo_refund" ("refund_trans_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_momo_refund_deleted_at" ON "momo_refund" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "momo_refund" cascade;`);
    this.addSql(`drop table if exists "momo_webhook_event" cascade;`);
    this.addSql(`drop table if exists "momo_payment" cascade;`);
  }
}
