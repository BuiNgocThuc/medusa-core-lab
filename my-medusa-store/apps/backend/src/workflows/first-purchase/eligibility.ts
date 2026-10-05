type FirstPurchaseCustomer = {
  has_account?: boolean | null
  orders?: unknown[] | null
}

type FirstPurchasePromotion = {
  status?: string | null
}

export function isEligibleForFirstPurchasePromotion(
  customer: FirstPurchaseCustomer | null | undefined,
  promotion: FirstPurchasePromotion | null | undefined,
  isAlreadyApplied: boolean,
) {
  return Boolean(
    promotion?.status === "active" &&
    !isAlreadyApplied &&
    customer?.has_account === true &&
    (customer.orders?.length ?? 0) === 0,
  )
}
