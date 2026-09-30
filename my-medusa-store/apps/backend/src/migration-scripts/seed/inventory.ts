import { MedusaContainer } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { createInventoryLevelsWorkflow } from "@medusajs/medusa/core-flows";

export async function seedInventory(
    container: MedusaContainer,
    stockLocationIdOrIds: string | string[]
) {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const locationIds = Array.isArray(stockLocationIdOrIds)
        ? stockLocationIdOrIds
        : [stockLocationIdOrIds];

    const { data: inventoryItems } = await query.graph({
        entity: "inventory_item",
        fields: ["id", "location_levels.*"],
    });

    const inventoryLevels: any[] = [];
    for (const locId of locationIds) {
        for (const item of inventoryItems) {
            const hasLevel = (item as any).location_levels?.some(
                (lvl: any) => lvl.location_id === locId
            );
            if (!hasLevel) {
                inventoryLevels.push({
                    location_id: locId,
                    stocked_quantity: 1000,
                    inventory_item_id: item.id,
                });
            }
        }
    }

    if (inventoryLevels.length > 0) {
        await createInventoryLevelsWorkflow(container).run({
            input: {
                inventory_levels: inventoryLevels,
            },
        });
    }
}
