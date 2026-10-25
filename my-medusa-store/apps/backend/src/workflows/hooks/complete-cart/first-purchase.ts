import { throwInvalidPromotion } from "../shared/errors"
import { Promotion, Query } from "../shared/types"
import {
    hasFirstPurchasePromotion,
    validateFirstPurchaseCustomerEligibility,
} from "../shared/promotion-eligibility"

export async function validateCompleteCartFirstPurchasePromotion(
    query: Query,
    promotions: Promotion[],
    customerId?: string | null,
) {
    if (!hasFirstPurchasePromotion(promotions.map((promotion) => promotion.code))) return
    if (!customerId) throwInvalidPromotion("Ưu đãi đơn đầu cần đăng nhập")

    const { data: customers } = await query.graph(
        {
            entity: "customer",
            fields: ["id", "has_account", "orders.id"],
            filters: { id: customerId },
        },
        { throwIfKeyNotFound: true },
    )
    const customer = customers[0]
    validateFirstPurchaseCustomerEligibility(customer)
}
