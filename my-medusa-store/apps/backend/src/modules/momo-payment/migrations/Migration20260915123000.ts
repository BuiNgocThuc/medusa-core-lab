import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260915123000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "momo_payment" add column if not exists "payment_option" text null;`);
    this.addSql(`alter table if exists "momo_payment" add column if not exists "order_type" text null;`);
    this.addSql(`alter table if exists "momo_payment" add column if not exists "user_fee" integer null;`);
    this.addSql(`alter table if exists "momo_payment" add column if not exists "deeplink_mini_app" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "momo_payment" drop column if exists "deeplink_mini_app";`);
    this.addSql(`alter table if exists "momo_payment" drop column if exists "user_fee";`);
    this.addSql(`alter table if exists "momo_payment" drop column if exists "order_type";`);
    this.addSql(`alter table if exists "momo_payment" drop column if exists "payment_option";`);
  }
}
