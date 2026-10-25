import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260921120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "vnpay_refund" ("id" text not null, "vnpay_payment_id" text not null, "payment_id" text null, "request_id" text not null, "txn_ref" text not null, "amount" integer not null, "transaction_type" text not null, "status" text check ("status" in ('pending', 'processing', 'succeeded', 'failed', 'manual_review')) not null default 'pending', "response_code" text null, "transaction_status" text null, "message" text null, "refund_transaction_no" text null, "raw_request" jsonb null, "raw_response" jsonb null, "processed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "vnpay_refund_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_vnpay_refund_request_id_unique" ON "vnpay_refund" ("request_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_vnpay_refund_vnpay_payment_id" ON "vnpay_refund" ("vnpay_payment_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_vnpay_refund_payment_id" ON "vnpay_refund" ("payment_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_vnpay_refund_txn_ref" ON "vnpay_refund" ("txn_ref") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_vnpay_refund_refund_transaction_no" ON "vnpay_refund" ("refund_transaction_no") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_vnpay_refund_deleted_at" ON "vnpay_refund" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "vnpay_refund" cascade;`);
  }
}
