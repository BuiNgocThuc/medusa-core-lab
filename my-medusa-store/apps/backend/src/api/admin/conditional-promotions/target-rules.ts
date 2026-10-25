import { ConditionalPromotionInput } from "./validators";

const nativeAttribute: Record<string, string> = {
    product: "items.product.id",
    category: "items.product.categories.id",
    collection: "items.product.collection_id",
    tag: "items.product.tags.id",
    type: "items.product.type_id",
};

export function nativeTargetRules(target: ConditionalPromotionInput["promotion"]["target"]) {
    return target.clauses.map((clause) => ({
        attribute: nativeAttribute[clause.attribute],
        operator: "in",
        values: clause.values,
    }));
}
