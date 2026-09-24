import { LOYALTY_MODULE, LoyaltyModuleService } from "@/src/modules/loyalty";
import { MedusaContainer } from "@medusajs/framework";

export async function seedLoyaltyBalance(
    container: MedusaContainer,
    customerId: string,
    points: number,
) {
    const loyalty = container.resolve(LOYALTY_MODULE) as LoyaltyModuleService;
    const [balance] = await loyalty.listLoyaltyPoints({ customer_id: customerId });
    if (balance) {
        return await loyalty.updateLoyaltyPoints({ id: balance.id, points });
    }
    return await loyalty.createLoyaltyPoints({ customer_id: customerId, points });
}
