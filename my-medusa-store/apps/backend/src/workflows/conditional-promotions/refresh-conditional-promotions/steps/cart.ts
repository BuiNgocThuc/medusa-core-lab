import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
    CONDITIONAL_PROMOTION_MODULE,
    ConditionalPromotionModuleService,
} from "../../../../modules/conditional-promotion";

export async function retrievePromotionCart(container: any, cartId: string) {
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as any;
    const { data } = await query.graph({
        entity: "cart",
        fields: [
            "id",
            "subtotal",
            "customer.id",
            "customer.has_account",
            "customer.tier.name",
            "region.name",
            "shipping_address.country_code",
            "items.quantity",
            "items.unit_price",
            "items.product_id",
            "items.product.id",
            "items.product.categories.id",
            "items.product.collection_id",
            "items.product.type_id",
            "items.product.tags.id",
            "items.variant.product.id",
            "items.variant.product.product_categories.name",
            "items.variant.product.product_categories.id",
            "items.variant.product.collection.handle",
            "items.variant.product.collection.id",
            "items.variant.product.type.id",
            "items.variant.product.tags.id",
            "promotions.id",
            "promotions.code",
            "promotions.is_automatic",
            "promotions.metadata",
            "metadata",
        ],
        filters: { id: cartId },
    });

    const cart = data[0];
    if (!cart) return null;

    const productIds = [...new Set(
        (cart.items ?? [])
            .map((item: any) => item.product_id ?? item.variant?.product?.id)
            .filter(Boolean),
    )];
    if (!productIds.length) return cart;

    const productModule = container.resolve(Modules.PRODUCT) as any;
    const products = await productModule.listProducts(
        { id: productIds },
        { relations: ["categories", "collection", "type", "tags"] },
    );
    const productsById = new Map(products.map((product: any) => [product.id, product]));

    return {
        ...cart,
        items: (cart.items ?? []).map((item: any) => ({
            ...item,
            product: productsById.get(item.product_id ?? item.variant?.product?.id) ?? item.product,
        })),
    };
}

export async function retrieveActiveCustomPromotions(container: any) {
    const conditionalService = container.resolve(
        CONDITIONAL_PROMOTION_MODULE,
    ) as ConditionalPromotionModuleService;
    const promotionModule = container.resolve(Modules.PROMOTION) as any;
    const [configs] = await conditionalService.listAndCountConditionalPromotions({
        status: "active",
    });
    const promotions = configs.length
        ? await promotionModule.listPromotions({
              id: configs.map((config: any) => config.promo_id),
          })
        : [];

    return { configs, promotions };
}
