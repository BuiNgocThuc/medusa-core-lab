export type Clause = {
    attribute: "product" | "category" | "collection" | "tag" | "type";
    values: string[];
};
export type Matcher = { mode: "all" | "any"; clauses: Clause[] };
export type QuantityCondition = {
    min_quantity: number;
    match: Matcher;
    subset_requirements?: Array<{ min_quantity: number; match: Matcher }>;
};
export type RuleTree = { version: 1; operator: "and"; conditions: QuantityCondition[] };
type Product = {
    id?: string;
    collection?: { id?: string } | null;
    collection_id?: string | null;
    type?: { id?: string } | null;
    type_id?: string | null;
    categories?: Array<{ id?: string }>;
    product_categories?: Array<{ id?: string }>;
    tags?: Array<{ id?: string }>;
};
type Item = {
    quantity: number;
    product?: Product;
    variant?: {
        product?: Product;
    };
};

function productFor(item: Item): Product | undefined {
    return item.product ?? item.variant?.product;
}

function clauseMatches(item: Item, clause: Clause) {
    const product = productFor(item);
    const categories = product?.product_categories ?? product?.categories ?? [];
    const ids =
        clause.attribute === "product"
            ? [product?.id]
            : clause.attribute === "collection"
              ? [product?.collection?.id ?? product?.collection_id]
              : clause.attribute === "type"
                ? [product?.type?.id ?? product?.type_id]
                : clause.attribute === "category"
                  ? categories.map((entry) => entry.id)
                  : (product?.tags ?? []).map((entry) => entry.id);

    return ids.some((id) => id && clause.values.includes(id));
}
export function matches(item: Item, matcher: Matcher) {
    const values = matcher.clauses.map((clause) => clauseMatches(item, clause));

    return matcher.mode === "all" ? values.every(Boolean) : values.some(Boolean);
}
