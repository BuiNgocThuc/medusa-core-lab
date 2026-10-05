import { sdk } from "../../lib/sdk";
import {
    ConditionalPromotionForm,
    blankClause,
    toApiConditions,
    toApiMatcher,
    toFormConditions,
    toFormMatcher,
} from "../../components/conditional-promotion-form";

export {
    ConditionalPromotionForm,
    blankClause,
    toApiConditions,
    toApiMatcher,
    toFormConditions,
    toFormMatcher,
};

export const fetchConditionalPromotionOptions = async () => ({
    product: (await sdk.admin.product.list({ limit: 100 })).products,
    category: (await sdk.admin.productCategory.list({ limit: 100 })).product_categories,
    collection: (await sdk.admin.productCollection.list({ limit: 100 })).collections,
    tag: (await sdk.admin.productTag.list({ limit: 100 })).product_tags,
    type: (await sdk.admin.productType.list({ limit: 100 })).product_types,
});

export const initialConditionalPromotion = {
    title: "",
    code: "",
    percentage: 100,
    max_quantity: 1,
    priority: 0,
    description: "",
    terms: "",
    cta_url: "",
    conditions: [
        {
            min_quantity: 1,
            match: { mode: "all", clauses: [blankClause()] },
            subset_requirements: [],
        },
    ],
    target: { mode: "all", clauses: [blankClause()] },
};

export const conditionalPromotionErrorMessage = (error: any, fallback: string) =>
    error?.message || fallback;

export const buildConditionalPromotionPayload = (
    value: any,
    status: "active" | "inactive",
    placements = { category_ids: [], collection_ids: [] },
) => ({
    title: value.title,
    description: value.description || null,
    terms: value.terms || null,
    cta_url: value.cta_url || null,
    priority: value.priority,
    status,
    rule_tree: {
        version: 1,
        operator: "and",
        conditions: toApiConditions(value.conditions),
    },
    promotion: {
        code: value.code,
        percentage: value.percentage,
        max_quantity: value.max_quantity,
        target: toApiMatcher(value.target),
    },
    placements,
});
