import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260918090000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "vnpay_payment" ("id" text not null, "payment_session_id" text not null, "cart_id" text null, "order_id" text null, "provider_id" text not null, "vnp_txn_ref" text not null, "amount" integer not null, "currency_code" text not null, "status" text check ("status" in ('initiated', 'pending', 'paid', 'failed', 'canceled', 'expired', 'refunded', 'partially_refunded', 'manual_review')) not null default 'initiated', "response_code" text null, "transaction_status" text null, "message" text null, "transaction_no" text null, "bank_code" text null, "bank_tran_no" text null, "card_type" text null, "pay_date" text null, "payment_url" text null, "raw_create_params" jsonb null, "raw_gateway_payload" jsonb null, "paid_at" timestamptz null, "expires_at" timestamptz null, "last_queried_at" timestamptz null, "query_count" integer not null default 0, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "vnpay_payment_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_vnpay_payment_payment_session_id_unique" ON "vnpay_payment" ("payment_session_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_vnpay_payment_vnp_txn_ref_unique" ON "vnpay_payment" ("vnp_txn_ref") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_vnpay_payment_transaction_no_unique" ON "vnpay_payment" ("transaction_no") WHERE transaction_no IS NOT NULL AND deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_vnpay_payment_cart_id" ON "vnpay_payment" ("cart_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_vnpay_payment_order_id" ON "vnpay_payment" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_vnpay_payment_provider_id" ON "vnpay_payment" ("provider_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_vnpay_payment_deleted_at" ON "vnpay_payment" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "vnpay_webhook_event" ("id" text not null, "vnpay_payment_id" text null, "event_key" text not null, "txn_ref" text null, "transaction_no" text null, "response_code" text null, "transaction_status" text null, "signature_valid" boolean not null default false, "processing_status" text check ("processing_status" in ('received', 'processed', 'duplicate', 'ignored', 'failed')) not null default 'received', "raw_payload" jsonb not null, "error_message" text null, "processed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "vnpay_webhook_event_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_vnpay_webhook_event_event_key_unique" ON "vnpay_webhook_event" ("event_key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_vnpay_webhook_event_vnpay_payment_id" ON "vnpay_webhook_event" ("vnpay_payment_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_vnpay_webhook_event_txn_ref" ON "vnpay_webhook_event" ("txn_ref") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_vnpay_webhook_event_transaction_no" ON "vnpay_webhook_event" ("transaction_no") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_vnpay_webhook_event_deleted_at" ON "vnpay_webhook_event" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "vnpay_webhook_event" cascade;`);
    this.addSql(`drop table if exists "vnpay_payment" cascade;`);
  }
}
