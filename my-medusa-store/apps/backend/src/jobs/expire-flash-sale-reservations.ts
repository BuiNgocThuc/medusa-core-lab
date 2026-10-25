import { MedusaContainer } from "@medusajs/framework/types";
import { expireFlashSales } from "@/workflows/flash-sales";

export default async function expireFlashSaleReservations(container: MedusaContainer) {
    await expireFlashSales(container);
}

export const config = { name: "expire-flash-sale-reservations", schedule: "* * * * *" };
