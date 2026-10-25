type Clause = {
  attribute: "product" | "category" | "collection" | "tag" | "type"
  value?: string
  values?: string[]
}

type Matcher = { mode?: "all" | "any"; clauses?: Clause[] }
type Options = Record<string, Array<{ id: string; title?: string; name?: string; handle?: string }>>

const labels: Record<Clause["attribute"], string> = {
  product: "product",
  category: "category",
  collection: "collection",
  tag: "tag",
  type: "product type",
}

function optionName(attribute: Clause["attribute"], id: string, options: Options) {
  const option = (options[attribute] ?? []).find((entry) => entry.id === id)
  return option?.title ?? option?.name ?? option?.handle ?? "unknown item"
}

function clauseText(clause: Clause, options: Options) {
  const ids = clause.values ?? (clause.value ? [clause.value] : [])
  if (!ids.length) return `no ${labels[clause.attribute]} selected`
  const names = ids.map((id) => `“${optionName(clause.attribute, id, options)}”`).join(", ")
  return `in ${labels[clause.attribute]} ${names}`
}

function matcherText(matcher: Matcher, options: Options) {
  const clauses = matcher.clauses ?? []
  if (!clauses.length) return "no item selected"
  const connector = matcher.mode === "any" ? " or " : " and "
  return clauses.map((clause) => clauseText(clause, options)).join(connector)
}

export function conditionalPromotionRuleRows(
  ruleTree: { conditions?: Array<{ min_quantity?: number; match?: Matcher; subset_requirements?: Array<{ min_quantity?: number; match?: Matcher }> }> } | undefined,
  options: Options,
) {
  return (ruleTree?.conditions ?? []).map((condition, index) => ({
    id: index + 1,
    minimumQuantity: condition.min_quantity ?? 0,
    matcher: matcherText(condition.match ?? {}, options),
    nested: (condition.subset_requirements ?? []).map((subset) => ({
      minimumQuantity: subset.min_quantity ?? 0,
      matcher: matcherText(subset.match ?? {}, options),
    })),
  }))
}

export function conditionalPromotionTargetText(target: Matcher | undefined, options: Options) {
  return matcherText(target ?? {}, options)
}

export function conditionalPromotionSummary(input: {
  ruleTree?: { conditions?: Array<{ min_quantity?: number; match?: Matcher; subset_requirements?: Array<{ min_quantity?: number; match?: Matcher }> }> }
  target?: Matcher
  percentage?: number
  maxQuantity?: number
  options: Options
}) {
  const conditions = input.ruleTree?.conditions ?? []
  const requirements = conditions.length
    ? conditions.map((condition) => {
        const quantity = condition.min_quantity ?? 0
        const parent = `at least ${quantity} item${quantity === 1 ? "" : "s"} ${matcherText(condition.match ?? {}, input.options)}`
        const subsets = (condition.subset_requirements ?? []).map((subset) =>
          `including at least ${subset.min_quantity ?? 0} item${subset.min_quantity === 1 ? "" : "s"} ${matcherText(subset.match ?? {}, input.options)}`,
        )
        return [parent, ...subsets].join(", ")
      }).join("; and ")
    : "no eligibility requirements"
  const target = matcherText(input.target ?? {}, input.options)
  const percentage = input.percentage ?? 0
  const maxQuantity = input.maxQuantity ?? 0

  return {
    eligibility: `Automatically applies when the cart contains ${requirements}.`,
    benefit: `Benefit: ${percentage}% off up to ${maxQuantity} item${maxQuantity === 1 ? "" : "s"} ${target}.`,
  }
}
