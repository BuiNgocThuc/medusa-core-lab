import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260918093000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`update "loyalty_point" as lp set "points" = lp."points" + reservations."points_to_restore" from (select "customer_id", sum(-"points") as "points_to_restore" from "loyalty_transaction" where "type" = 'redemption_reservation' and "status" = 'reserved' and "deleted_at" is null group by "customer_id") as reservations where lp."customer_id" = reservations."customer_id" and lp."deleted_at" is null;`);
    this.addSql(`update "loyalty_transaction" set "status" = 'released' where "type" = 'redemption_reservation' and "status" = 'reserved' and "deleted_at" is null;`);
  }

  override async down(): Promise<void> {}
}
