import { MedusaContainer } from "@medusajs/framework";
import { createProductCategoriesWorkflow } from "@medusajs/medusa/core-flows";

export const CATEGORY_NAMES = [
    "Rackets",
    "Strings",
    "Grips",
    "Bags",
    "Shoes",
    "Socks",
    "Insoles",
    "Shuttlecocks",
    "Tubes",
] as const;

export async function seedCategories(container: MedusaContainer) {
    const { result: categoryResult } = await createProductCategoriesWorkflow(container).run({
        input: {
            product_categories: CATEGORY_NAMES.map((name) => ({
                name,
                is_active: true,
            })),
        },
    });

    return categoryResult;
}
