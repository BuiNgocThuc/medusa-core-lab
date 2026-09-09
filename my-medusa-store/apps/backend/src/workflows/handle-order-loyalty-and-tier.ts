import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import {
  CUSTOMER_TIERS,
  type CustomerTier,
  getCustomerTier,
  LOYALTY_EARN_SPEND,
  LOYALTY_PROMOTION_PREFIX,
} from "../constants"
import { LOYALTY_MODULE } from "../modules/loyalty"

type HandleOrderInput = {
  order_id: string
}

type HandleOrderResult = {
  skipped: boolean
  customer_id?: string
  tier?: CustomerTier
  earned_points?: number
  balance?: number
}

const handleOrderLoyaltyAndTierStep = createStep<
  HandleOrderInput,
  HandleOrderResult,
  HandleOrderResult
>(
  "handle-order-loyalty-and-tier",
  async ({ order_id }: HandleOrderInput, { container }) => {
    const orderModule = container.resolve(Modules.ORDER) as any
    const customerModule = container.resolve(Modules.CUSTOMER) as any
    const promotionModule = container.resolve(Modules.PROMOTION) as any
    const loyaltyModule = container.resolve(LOYALTY_MODULE) as any
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "customer_id", "subtotal", "discount_total", "promotions.id", "promotions.code"],
      filters: { id: order_id },
    })
    const order = orders[0]
    if (!order?.customer_id) {
      return new StepResponse({ skipped: true })
    }

    const existingEarns = await loyaltyModule.listLoyaltyTransactions({
      order_id,
      type: "earn",
    })
    if (existingEarns.length) {
      return new StepResponse({ skipped: true })
    }

    const loyaltyPromotion = order.promotions?.find((promotion: { code?: string }) =>
      promotion.code?.startsWith(`${LOYALTY_PROMOTION_PREFIX}-`)
    )
    if (loyaltyPromotion) {
      const points = Number(loyaltyPromotion.code.split("-")[1])
      const existingRedemption = await loyaltyModule.listLoyaltyTransactions({
        promotion_id: loyaltyPromotion.id,
        type: "redeem",
      })
      const [account] = await loyaltyModule.listLoyaltyAccounts({
        customer_id: order.customer_id,
      })

      if (!existingRedemption.length && account) {
        await loyaltyModule.updateLoyaltyAccounts(account.id, {
          balance: account.balance - points,
        })
        await loyaltyModule.createLoyaltyTransactions({
          customer_id: order.customer_id,
          type: "redeem",
          points: -points,
          order_id,
          promotion_id: loyaltyPromotion.id,
        })
        await promotionModule.updatePromotions(loyaltyPromotion.id, {
          status: "inactive",
        })
      }
    }

    const customerOrders = await orderModule.listOrders({
      customer_id: order.customer_id,
    })
    const totalSpend = customerOrders.reduce(
      (sum: number, customerOrder: { total?: number }) =>
        sum + (customerOrder.total ?? 0),
      0
    )
    const tier = getCustomerTier(totalSpend)
    const groups = await customerModule.listCustomerGroups({
      name: Object.values(CUSTOMER_TIERS).map((item) => item.name),
    })
    const tierGroup = groups.find(
      (group: { name: string }) => group.name === CUSTOMER_TIERS[tier].name
    )

    if (!tierGroup) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Customer tiers have not been initialized. Run setup-promotions.ts first."
      )
    }

    await customerModule.updateCustomers(order.customer_id, {
      group_ids: [tierGroup.id],
    })

    const eligibleAmount = Math.max(
      0,
      (order.subtotal ?? 0) - (order.discount_total ?? 0)
    )
    const earnedPoints = Math.floor(eligibleAmount / LOYALTY_EARN_SPEND)
    const [account] = await loyaltyModule.listLoyaltyAccounts({
      customer_id: order.customer_id,
    })
    const loyaltyAccount = account
      ? await loyaltyModule.updateLoyaltyAccounts(account.id, {
          balance: account.balance + earnedPoints,
        })
      : await loyaltyModule.createLoyaltyAccounts({
          customer_id: order.customer_id,
          balance: earnedPoints,
        })

    await loyaltyModule.createLoyaltyTransactions({
      customer_id: order.customer_id,
      type: "earn",
      points: earnedPoints,
      order_id,
    })

    return new StepResponse({
      skipped: false,
      customer_id: order.customer_id,
      tier,
      earned_points: earnedPoints,
      balance: loyaltyAccount.balance,
    })
  }
)

export const handleOrderLoyaltyAndTierWorkflow = createWorkflow(
  "handle-order-loyalty-and-tier",
  (input: HandleOrderInput) => {
    const result = handleOrderLoyaltyAndTierStep(input)
    return new WorkflowResponse(result)
  }
)
