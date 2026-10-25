import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
    CampaignDTO,
    CreatePromotionDTO,
    IPromotionModuleService,
    PromotionDTO,
} from "@medusajs/framework/types";
import { MedusaError, Modules } from "@medusajs/framework/utils";
import {
    FLASH_SALE_SCHEDULE_MODULE,
    FlashSaleScheduleModuleService,
} from "@/modules/flash-sale-schedule";
import { FlashSaleScheduleType } from "@/modules/flash-sale-schedule/models/flash-sale-schedule";
import { FlashSaleInput } from "./validators";
import { campaignIsAvailable, FlashSchedule, isFlashScheduleOpen } from "@/workflows/flash-sales";

type Schedule = FlashSaleScheduleType & { weekdays: number[] };
type FlashSaleView = Schedule & {
    promotion?: PromotionDTO;
    campaign?: CampaignDTO;
    runtime_status: "active" | "scheduled" | "due" | "inactive";
};

function promotionModule(scope: MedusaRequest["scope"]): IPromotionModuleService {
    return scope.resolve(Modules.PROMOTION) as IPromotionModuleService;
}

async function scheduleRows(scope: MedusaRequest["scope"]) {
    const schedules = scope.resolve(FLASH_SALE_SCHEDULE_MODULE) as FlashSaleScheduleModuleService;
    const promotion = promotionModule(scope);
    const [entries, count] = (await schedules.listAndCountFlashSaleSchedules(
        {},
        { take: 100 },
    )) as [Schedule[], number];
    const promotions = entries.length
        ? await promotion.listPromotions(
              { id: entries.map((entry) => entry.promo_id) },
              { relations: ["application_method", "campaign", "campaign.budget"] },
          )
        : [];
    return { entries, count, byId: new Map(promotions.map((entry) => [entry.id, entry])) };
}

function view(schedule: Schedule, promotion?: PromotionDTO): FlashSaleView {
    const campaign = promotion?.campaign;
    const now = new Date();
    const running =
        schedule.status !== "inactive" &&
        promotion?.status === "active" &&
        campaignIsAvailable(campaign, now) &&
        isFlashScheduleOpen(schedule as FlashSchedule, now);
    const runtime_status =
        schedule.status === "inactive" || promotion?.status !== "active"
            ? "inactive"
            : running
              ? "active"
              : campaign?.ends_at && new Date(campaign.ends_at) <= now
                ? "due"
                : "scheduled";
    return { ...schedule, promotion, campaign, runtime_status };
}

function localInstant(date: Date, time: string, timezone: string) {
    const target = Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        Number(time.slice(0, 2)),
        Number(time.slice(3, 5)),
    );
    let value = target;
    for (let attempt = 0; attempt < 3; attempt++) {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: timezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
        }).formatToParts(new Date(value));
        const part = (name: string) =>
            Number(parts.find((entry) => entry.type === name)?.value ?? 0);
        value +=
            target -
            Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"));
    }
    return new Date(value);
}

function datesOverlap(left: CampaignDTO | undefined, right: FlashSaleInput["campaign"]) {
    const start = Math.max(
        left?.starts_at ? new Date(left.starts_at).getTime() : Number.NEGATIVE_INFINITY,
        right.starts_at.getTime(),
    );
    const end = Math.min(
        left?.ends_at ? new Date(left.ends_at).getTime() : Number.POSITIVE_INFINITY,
        right.ends_at.getTime(),
    );
    return start < end ? { start: new Date(start), end: new Date(end) } : null;
}

function schedulesOverlap(
    left: Schedule,
    right: Pick<FlashSaleInput, "timezone" | "start_time" | "end_time" | "weekdays">,
    period: { start: Date; end: Date },
) {
    const day = new Date(
        Date.UTC(
            period.start.getUTCFullYear(),
            period.start.getUTCMonth(),
            period.start.getUTCDate(),
        ),
    );
    const last = new Date(
        Date.UTC(period.end.getUTCFullYear(), period.end.getUTCMonth(), period.end.getUTCDate()),
    );
    for (; day <= last; day.setUTCDate(day.getUTCDate() + 1)) {
        const weekday = day.getUTCDay();
        if (!left.weekdays.includes(weekday) || !right.weekdays.includes(weekday)) continue;
        const leftStart = localInstant(day, left.start_time, left.timezone);
        const leftEnd = localInstant(day, left.end_time, left.timezone);
        const rightStart = localInstant(day, right.start_time, right.timezone);
        const rightEnd = localInstant(day, right.end_time, right.timezone);
        if (
            leftStart < rightEnd &&
            rightStart < leftEnd &&
            leftStart < period.end &&
            rightStart < period.end &&
            leftEnd > period.start &&
            rightEnd > period.start
        )
            return true;
    }
    return false;
}

export async function assertFlashSaleDoesNotOverlap(
    scope: MedusaRequest["scope"],
    input: FlashSaleInput,
) {
    const { entries, byId } = await scheduleRows(scope);
    for (const schedule of entries) {
        if (schedule.status === "inactive") continue;
        const promotion = byId.get(schedule.promo_id);
        const period = datesOverlap(promotion?.campaign, input.campaign);
        if (promotion?.status === "active" && period && schedulesOverlap(schedule, input, period))
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "Flash Sale schedule overlaps an active Flash Sale",
            );
    }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const { entries, count, byId } = await scheduleRows(req.scope);
    res.json({ flash_sales: entries.map((entry) => view(entry, byId.get(entry.promo_id))), count });
}

export async function POST(req: MedusaRequest<FlashSaleInput>, res: MedusaResponse) {
    const input = req.validatedBody;
    const now = new Date();
    if (input.campaign.ends_at <= now) {
        throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "Campaign end time must be in the future",
        );
    }
    const scheduleForStatus = {
        id: "new-flash-sale",
        status: "scheduled" as const,
        timezone: input.timezone,
        start_time: input.start_time,
        end_time: input.end_time,
        weekdays: input.weekdays,
        max_discount_amount: input.max_discount_amount,
    };
    const isOpenNow =
        input.campaign.starts_at <= now && isFlashScheduleOpen(scheduleForStatus, now);
    if (input.campaign.starts_at < now && !isOpenNow) {
        throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "Campaign start time is in the past. Choose a future window or create it while the window is active",
        );
    }
    const status = isOpenNow ? "active" : "scheduled";
    await assertFlashSaleDoesNotOverlap(req.scope, input);
    const promotion = promotionModule(req.scope);
    const schedules = req.scope.resolve(
        FLASH_SALE_SCHEDULE_MODULE,
    ) as FlashSaleScheduleModuleService;
    let campaignId: string | undefined;
    try {
        const campaign = await promotion.createCampaigns({
            name: input.campaign.name,
            campaign_identifier: input.campaign.campaign_identifier,
            starts_at: input.campaign.starts_at,
            ends_at: input.campaign.ends_at,
            budget: {
                type: input.campaign.budget_type,
                limit: input.campaign.budget_limit,
                ...(input.campaign.budget_type === "spend" ? { currency_code: "vnd" } : {}),
            },
        });
        campaignId = campaign.id;
        const promotionInput: CreatePromotionDTO = {
            code: input.promotion.code,
            type: "standard",
            status: "active",
            campaign_id: campaign.id,
            is_automatic: false,
            application_method: {
                type: "percentage",
                value: input.promotion.percentage,
                target_type: "order",
                allocation: "across",
            },
            metadata: {
                source: "flash-sale-schedule",
                flash_source: true,
                usage_limit: input.campaign.usage_limit,
            },
        };
        const source = await promotion.createPromotions(promotionInput);
        const flash_sale = await schedules.createFlashSaleSchedules({
            promo_id: source.id,
            status,
            timezone: input.timezone,
            start_time: input.start_time,
            end_time: input.end_time,
            weekdays: [...new Set(input.weekdays)].sort(),
            max_discount_amount: input.max_discount_amount,
        } as Schedule);
        res.status(201).json({ flash_sale: view(flash_sale as Schedule, source) });
    } catch (error) {
        if (campaignId) await promotion.deleteCampaigns(campaignId);
        throw error;
    }
}
