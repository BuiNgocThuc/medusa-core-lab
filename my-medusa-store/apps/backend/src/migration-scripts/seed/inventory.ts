import { MedusaContainer } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { createInventoryLevelsWorkflow } from "@medusajs/medusa/core-flows";

export async function seedInventory(container: MedusaContainer, stockLocationId: string) {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    const { data: inventoryItems } = await query.graph({
        entity: "inventory_item",
        fields: ["id"],
    });

    await createInventoryLevelsWorkflow(container).run({
        input: {
            inventory_levels: inventoryItems.map((item) => ({
                location_id: stockLocationId,
                stocked_quantity: 1000,
                inventory_item_id: item.id,
            })),
        },
    });
}
