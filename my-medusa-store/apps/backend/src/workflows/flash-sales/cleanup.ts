import {
    PROMOTION_ENTITLEMENT_MODULE,
    PromotionEntitlementModuleService,
} from "@/modules/promotion-entitlement";
import {
    FLASH_SALE_SCHEDULE_MODULE,
    FlashSaleScheduleModuleService,
} from "@/modules/flash-sale-schedule";
import { Modules } from "@medusajs/framework/utils";
import { removeFlashSaleClaimWorkflow } from "./claim";
import { campaignIsAvailable, isFlashScheduleOpen } from "./schedule";

export async function cleanupFlashSale(container: any, scheduleId: string) {
    const entitlements = container.resolve(
        PROMOTION_ENTITLEMENT_MODULE,
    ) as PromotionEntitlementModuleService;
    const reservations = await entitlements.listFlashRedemptions({
        flash_sale_schedule_id: scheduleId,
        state: "reserved",
    });
    for (const reservation of reservations) {
        if (reservation.cart_id)
            await removeFlashSaleClaimWorkflow(container).run({
                input: { cart_id: reservation.cart_id },
            });
    }
}

export async function expireFlashSales(container: any) {
    const entitlements = container.resolve(
        PROMOTION_ENTITLEMENT_MODULE,
    ) as PromotionEntitlementModuleService;
    const schedules = container.resolve(
        FLASH_SALE_SCHEDULE_MODULE,
    ) as FlashSaleScheduleModuleService;
    const promotionModule = container.resolve(Modules.PROMOTION) as any;
    const [activeSchedules] = await schedules.listAndCountFlashSaleSchedules({
        status: ["active", "scheduled"],
    } as any);
    if (activeSchedules.length) {
        const promotions = await promotionModule.listPromotions(
            { id: activeSchedules.map((schedule: any) => schedule.promo_id) },
            { relations: ["campaign"] },
        );
        const promotionsById = new Map<string, any>(
            promotions.map((promotion: any) => [promotion.id, promotion]),
        );
        const now = new Date();
        for (const schedule of activeSchedules as any[]) {
            const campaign = promotionsById.get(schedule.promo_id)?.campaign;
            if (campaign?.ends_at && new Date(campaign.ends_at) <= now) {
                await schedules.updateFlashSaleSchedules({ id: schedule.id, status: "due" } as any);
                await cleanupFlashSale(container, schedule.id);
                continue;
            }
            const isActiveWindow = campaignIsAvailable(campaign, now) && isFlashScheduleOpen({ ...schedule, status: "scheduled" }, now);
            const status = isActiveWindow ? "active" : "scheduled";
            if (schedule.status !== status) {
                await schedules.updateFlashSaleSchedules({ id: schedule.id, status } as any);
            }
        }
    }
    for (const reservation of await entitlements.listFlashRedemptions({ state: "reserved" })) {
        if (!reservation.expires_at || reservation.expires_at > new Date()) continue;
        if (reservation.flash_sale_schedule_id)
            await cleanupFlashSale(container, reservation.flash_sale_schedule_id);
        else if (reservation.cart_id)
            await entitlements.releaseFlashRedemption(reservation.cart_id);
    }
}
