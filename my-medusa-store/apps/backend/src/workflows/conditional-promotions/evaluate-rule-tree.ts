import { Matcher, matches, RuleTree } from "./rules";

function quantityForMatcher(items: any[], matcher: Matcher) {
    return items.reduce(
        (total, item) => total + (matches(item, matcher) ? Number(item.quantity) : 0),
        0,
    );
}

export function evaluateConditionalPromotion(config: any, items: any[]) {
    const tree = config.rule_tree as RuleTree;

    const eligible = tree.conditions.every((condition) => {
        const parent = items.filter((item) => matches(item, condition.match));

        return (
            quantityForMatcher(items, condition.match) >= condition.min_quantity &&
            (condition.subset_requirements ?? []).every(
                (subset: any) =>
                    quantityForMatcher(parent, subset.match) >=
                    subset.min_quantity,
            )
        );
    });

    if (!eligible) return null;

    const target = items
        .filter((item) => matches(item, config.target as Matcher))
        .flatMap((item) =>
            Array.from({ length: Number(item.quantity) }, () => Number(item.unit_price)),
        )
        .sort((left, right) => left - right);
    if (target.length < Number(config.max_quantity)) return null;

    return target.slice(0, Number(config.max_quantity)).reduce((sum, price) => sum + price, 0);
}
