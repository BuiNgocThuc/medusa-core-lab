import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, MedusaError, Modules, PromotionActions } from "@medusajs/framework/utils"
import { updateCartPromotionsWorkflow } from "@medusajs/medusa/core-flows"
import { FLASH_SALE_SCHEDULE_MODULE, FlashSaleScheduleModuleService } from "@/modules/flash-sale-schedule"
import { PROMOTION_ENTITLEMENT_MODULE, PromotionEntitlementModuleService } from "@/modules/promotion-entitlement"
import { campaignIsAvailable, flashScheduleEnd, isFlashScheduleOpen } from "./schedule"

const adjustmentCode = (promotionId: string) => `FLASH-ADJUSTMENT-${promotionId}`

export async function syncFlashAdjustments(container: any, cartId: string, promotionId: string, amount: number) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
  const cartModule = container.resolve(Modules.CART) as any
  const { data } = await query.graph({ entity: "cart", fields: ["id", "items.id", "items.subtotal", "items.adjustments.id", "items.adjustments.code", "items.adjustments.promotion_id"], filters: { id: cartId } })
  const cart = data[0]
  const existing = (cart?.items ?? []).flatMap((item: any) => (item.adjustments ?? []).filter((adjustment: any) => adjustment.promotion_id === promotionId || adjustment.code === adjustmentCode(promotionId)))
  if (existing.length) await cartModule.softDeleteLineItemAdjustments(existing.map((adjustment: any) => adjustment.id))
  const items = (cart?.items ?? []).map((item: any) => ({ id: item.id, subtotal: Number(item.subtotal ?? 0) })).filter((item: any) => item.subtotal > 0)
  const total = items.reduce((sum: number, item: any) => sum + item.subtotal, 0)
  let allocated = 0
  const adjustments = items.map((item: any, index: number) => {
    const value = index === items.length - 1 ? amount - allocated : Math.min(item.subtotal, Math.floor(amount * item.subtotal / total))
    allocated += value
    return { item_id: item.id, code: adjustmentCode(promotionId), amount: value }
  }).filter((adjustment: any) => adjustment.amount > 0)
  if (adjustments.length) await cartModule.addLineItemAdjustments(adjustments)
}

const claimFlashSaleStep = createStep("claim-flash-sale", async ({ cart_id, code }: { cart_id: string; code: string }, { container }) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
  const promotionModule = container.resolve(Modules.PROMOTION) as any
  const cartModule = container.resolve(Modules.CART) as any
  const schedules = container.resolve(FLASH_SALE_SCHEDULE_MODULE) as FlashSaleScheduleModuleService
  const entitlements = container.resolve(PROMOTION_ENTITLEMENT_MODULE) as PromotionEntitlementModuleService
  const locking = container.resolve(Modules.LOCKING) as any
  const { data } = await query.graph({ entity: "cart", fields: ["id", "customer_id", "subtotal", "currency_code", "metadata", "promotions.id", "promotions.code", "items.id", "items.subtotal"], filters: { id: cart_id } })
  const cart = data[0]
  if (!cart?.customer_id) throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Vui lòng đăng nhập để claim Flash Sale")
  if ((cart.promotions ?? []).length) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Giỏ hàng đã có ưu đãi. Mỗi đơn chỉ áp dụng một ưu đãi.")
  if (Number(cart.subtotal) <= 0) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Giỏ hàng cần có sản phẩm để dùng Flash Sale")
  const [source] = await promotionModule.listPromotions({ code: code.toUpperCase() }, { relations: ["application_method", "campaign", "campaign.budget"] })
  if (!source?.metadata?.flash_source) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Mã Flash Sale không hợp lệ")
  const [schedule] = await schedules.listFlashSaleSchedules({ promo_id: source.id }) as any[]
  if (!schedule || !isFlashScheduleOpen(schedule) || !campaignIsAvailable(source.campaign)) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Flash Sale hiện không trong thời gian áp dụng")
  const campaignId = source.campaign_id ?? source.campaign?.id
  const keys = [`flash-cart-${cart.id}`, `flash-customer-${cart.customer_id}`, `flash-campaign-${campaignId}`]
  for (const key of keys) await locking.acquire(key, { expire: 30 })
  try {
    const amount = Math.min(Math.floor(Number(cart.subtotal) * Number(source.application_method?.value ?? 0) / 100), Number(schedule.max_discount_amount))
    await entitlements.reserveFlashRedemption({ customer_id: cart.customer_id, cart_id: cart.id, amount, flash_sale_schedule_id: schedule.id, source_promotion_id: source.id, campaign_id: campaignId, expires_at: flashScheduleEnd(schedule), usage_limit: Number(source.metadata?.usage_limit ?? 2) })
    await updateCartPromotionsWorkflow(container).run({ input: { cart_id: cart.id, promo_codes: [source.code], action: PromotionActions.ADD, force_refresh_payment_collection: false } })
    await syncFlashAdjustments(container, cart.id, source.id, amount)
    await cartModule.updateCarts(cart.id, { metadata: { ...(cart.metadata ?? {}), flash_sale_schedule_id: schedule.id, flash_promotion_id: source.id } })
    return new StepResponse({ cart_id: cart.id, promotion_code: source.code, amount })
  } finally { for (const key of [...keys].reverse()) await locking.release(key) }
})

const removeFlashSaleClaimStep = createStep("remove-flash-sale-claim", async ({ cart_id }: { cart_id: string }, { container }) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
  const cartModule = container.resolve(Modules.CART) as any
  const { data } = await query.graph({ entity: "cart", fields: ["id", "metadata", "promotions.id", "promotions.code", "promotions.metadata", "items.adjustments.id", "items.adjustments.code"], filters: { id: cart_id } })
  const cart = data[0]
  const promotion = (cart?.promotions ?? []).find((entry: any) => entry.metadata?.flash_source)
  if (!promotion) return new StepResponse(null)
  await updateCartPromotionsWorkflow(container).run({ input: { cart_id, promo_codes: [promotion.code], action: PromotionActions.REMOVE, force_refresh_payment_collection: false } })
  const adjustments = (cart.items ?? []).flatMap((item: any) => (item.adjustments ?? []).filter((adjustment: any) => adjustment.code === adjustmentCode(promotion.id)))
  if (adjustments.length) await cartModule.softDeleteLineItemAdjustments(adjustments.map((adjustment: any) => adjustment.id))
  const { flash_sale_schedule_id, flash_promotion_id, ...metadata } = cart.metadata ?? {}
  await cartModule.updateCarts(cart_id, { metadata })
  const entitlements = container.resolve(PROMOTION_ENTITLEMENT_MODULE) as PromotionEntitlementModuleService
  await entitlements.releaseFlashRedemption(cart_id)
  return new StepResponse(promotion.code)
})

export const claimFlashSaleWorkflow = createWorkflow("claim-flash-sale", (input: { cart_id: string; code: string }) => new WorkflowResponse(claimFlashSaleStep(input)))
export const removeFlashSaleClaimWorkflow = createWorkflow("remove-flash-sale-claim", (input: { cart_id: string }) => new WorkflowResponse(removeFlashSaleClaimStep(input)))

export async function syncClaimedFlashSale(container: any, cartId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
  const promotionModule = container.resolve(Modules.PROMOTION) as any
  const schedules = container.resolve(FLASH_SALE_SCHEDULE_MODULE) as FlashSaleScheduleModuleService
  const entitlements = container.resolve(PROMOTION_ENTITLEMENT_MODULE) as PromotionEntitlementModuleService
  const { data } = await query.graph({ entity: "cart", fields: ["id", "customer_id", "subtotal", "promotions.id", "promotions.metadata"], filters: { id: cartId } })
  const cart = data[0]
  const sourceRef = (cart?.promotions ?? []).find((entry: any) => entry.metadata?.flash_source === true)
  if (!sourceRef) return null
  try {
    const source = await promotionModule.retrievePromotion(sourceRef.id, { relations: ["application_method", "campaign", "campaign.budget"] })
    const [schedule] = await schedules.listFlashSaleSchedules({ promo_id: source.id }) as any[]
    if (!cart.customer_id || Number(cart.subtotal) <= 0 || !schedule || !isFlashScheduleOpen(schedule) || !campaignIsAvailable(source.campaign)) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Flash Sale không còn hợp lệ")
    const amount = Math.min(Math.floor(Number(cart.subtotal) * Number(source.application_method?.value ?? 0) / 100), Number(schedule.max_discount_amount))
    await entitlements.reserveFlashRedemption({ customer_id: cart.customer_id, cart_id: cart.id, amount, flash_sale_schedule_id: schedule.id, source_promotion_id: source.id, campaign_id: source.campaign_id ?? source.campaign?.id, expires_at: flashScheduleEnd(schedule), usage_limit: Number(source.metadata?.usage_limit ?? 2) })
    await syncFlashAdjustments(container, cart.id, source.id, amount)
    return amount
  } catch {
    await removeFlashSaleClaimWorkflow(container).run({ input: { cart_id: cartId } })
    return null
  }
}
