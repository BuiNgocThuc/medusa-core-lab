import { convertToLocale } from "@lib/util/money"
import { clx } from "@medusajs/ui"
import { CustomerNextTier } from "types/tier"

type CustomerTierProps = {
  tierData: CustomerNextTier | null
}

const CustomerTier = ({ tierData }: CustomerTierProps) => {
  if (!tierData) {
    return null
  }

  const { current_tier, current_purchase_value, currency_code, next_tier_upgrade } = tierData
  let progressPercentage = 100
  let amountNeeded = 0
  let minPurchaseValue = 0
  let hasNextTier = false
  let nextTierName = ""

  if (next_tier_upgrade && next_tier_upgrade.tier) {
    hasNextTier = true
    nextTierName = next_tier_upgrade.tier.name
    amountNeeded = next_tier_upgrade.required_amount
    minPurchaseValue = next_tier_upgrade.next_tier_min_purchase
    const currentPurchase = next_tier_upgrade.current_purchase_value
    const nextMin = next_tier_upgrade.next_tier_min_purchase

    if (nextMin > 0) {
      progressPercentage = Math.min(100, Math.max(0, (currentPurchase / nextMin) * 100))
    } else {
      progressPercentage = 100
    }
  }

  if (!current_tier && !hasNextTier) {
    return null
  }

  return (
    <div className="flex flex-col gap-y-4">
      <h3 className="text-large-semi">Membership Tier</h3>
      <div className="flex flex-col gap-y-3">
        {current_tier ? (
          <div className="flex items-center gap-x-2">
            <span className="text-large-semi" data-testid="current-tier-name">{current_tier.name}</span>
          </div>
        ) : (
          <div className="flex items-center gap-x-2">
            <span className="text-large-semi text-ui-fg-subtle" data-testid="current-tier-name">No tier</span>
          </div>
        )}
        {hasNextTier && (
          <div className="flex flex-col gap-y-2">
            <div className="flex justify-between text-small-regular text-ui-fg-subtle">
              <span>Progress to {nextTierName}</span>
              {amountNeeded > 0 ? (
                <span>{convertToLocale({ amount: amountNeeded, currency_code })} to go</span>
              ) : <span className="text-ui-fg-interactive">Threshold reached!</span>}
            </div>
            <div className="flex">
              <div className={clx("h-2 rounded-s-full transition-all duration-500 ease-in-out", progressPercentage >= 100 ? "bg-gradient-to-r from-green-400 to-green-500" : "bg-gradient-to-r from-ui-fg-interactive to-ui-fg-interactive-hover", progressPercentage === 100 && "rounded-e-full")} style={{ width: `${progressPercentage}%` }} data-testid="tier-progress-bar" />
              <div className={clx("bg-gray-200 h-2 rounded-e-full flex-grow", progressPercentage === 0 && "rounded-s-full")} />
            </div>
            <div className="flex justify-between text-xs text-ui-fg-subtle">
              <span>{convertToLocale({ amount: next_tier_upgrade?.current_purchase_value || current_purchase_value, currency_code })}</span>
              {minPurchaseValue > 0 && <span>{convertToLocale({ amount: minPurchaseValue, currency_code })}</span>}
            </div>
          </div>
        )}
        {!hasNextTier && current_tier && <div className="text-small-regular text-ui-fg-subtle">You&apos;ve reached the highest tier!</div>}
      </div>
    </div>
  )
}

export default CustomerTier
