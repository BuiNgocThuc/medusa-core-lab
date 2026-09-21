import {
    FirstPurchaseCustomer,
    hasFirstPurchasePromotion,
    validateFirstPurchaseCustomerEligibility,
} from "../shared/promotion-eligibility"

export function validateAddedCartFirstPurchasePromotion(
    promoCodes: string[],
    customer?: FirstPurchaseCustomer,
) {
    if (!hasFirstPurchasePromotion(promoCodes)) return
    validateFirstPurchaseCustomerEligibility(customer)
}
