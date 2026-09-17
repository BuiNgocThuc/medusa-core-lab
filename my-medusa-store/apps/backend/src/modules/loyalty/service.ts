import { MedusaError, MedusaService } from "@medusajs/framework/utils";
import LoyaltyPoint from "./models/loyalty-point";
import { LoyaltyTransaction } from "./models";
import { InferTypeOf } from "@medusajs/framework/types";
import {
    LOYALTY_EARN_VND_PER_POINT,
    LOYALTY_REDEEM_POINTS_PER_BLOCK,
    LOYALTY_REDEEM_VND_PER_BLOCK,
} from "@/src/constant";

type LoyaltyPoint = InferTypeOf<typeof LoyaltyPoint>;

class LoyaltyModuleService extends MedusaService({
    LoyaltyPoint,
    LoyaltyTransaction,
}) {
    async addPoints(customerId: string, points: number): Promise<LoyaltyPoint> {
        const existingPoints = await this.listLoyaltyPoints({
            customer_id: customerId,
        });

        if (existingPoints.length > 0) {
            return await this.updateLoyaltyPoints({
                id: existingPoints[0].id,
                points: existingPoints[0].points + points,
            });
        }

        return await this.createLoyaltyPoints({
            customer_id: customerId,
            points,
        });
    }

    async deductPoints(customerId: string, points: number): Promise<LoyaltyPoint> {
        const existingPoints = await this.listLoyaltyPoints({
            customer_id: customerId,
        });

        if (existingPoints.length === 0 || existingPoints[0].points < points) {
            throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Insufficient loyalty points");
        }

        return await this.updateLoyaltyPoints({
            id: existingPoints[0].id,
            points: existingPoints[0].points - points,
        });
    }

    async getPoints(customerId: string): Promise<number> {
        const points = await this.listLoyaltyPoints({
            customer_id: customerId,
        });

        return points[0]?.points || 0;
    }

    async recordTransaction(input: {
        customer_id: string
        type: string
        reference_id: string
        points: number
        status?: string
        cart_id?: string | null
        order_id?: string | null
        promotion_id?: string | null
    }) {
        const [existing] = await this.listLoyaltyTransactions({
            type: input.type,
            reference_id: input.reference_id,
        })

        if (existing) {
            return existing
        }

        const transaction = await this.createLoyaltyTransactions(input)
        await this.addPoints(input.customer_id, input.points)

        return transaction
    }

    async releaseReservation(customerId: string, cartId: string, points: number) {
        const [reservation] = await this.listLoyaltyTransactions({
            type: "redemption_reservation",
            reference_id: cartId,
        })

        if (!reservation || reservation.status !== "reserved") {
            return reservation
        }

        await this.updateLoyaltyTransactions({ id: reservation.id, status: "released" })
        return await this.recordTransaction({
            customer_id: customerId,
            type: "redemption_release",
            reference_id: cartId,
            points,
            status: "released",
            cart_id: cartId,
        })
    }

    async calculatePointsFromAmount(amount: number): Promise<number> {
        if (amount < 0) {
            throw new MedusaError(MedusaError.Types.INVALID_DATA, "Amount cannot be negative");
        }

        return Math.floor(amount / LOYALTY_EARN_VND_PER_POINT);
    }

    async calculateDiscountAmountFromPoints(points: number): Promise<number> {
        if (points < 0) {
            throw new MedusaError(MedusaError.Types.INVALID_DATA, "Points cannot be negative");
        }

        return Math.floor(points / LOYALTY_REDEEM_POINTS_PER_BLOCK) * LOYALTY_REDEEM_VND_PER_BLOCK;
    }

    async calculatePointsFromDiscountAmount(amount: number): Promise<number> {
        if (amount < 0 || amount % LOYALTY_REDEEM_VND_PER_BLOCK !== 0) {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "Loyalty discount amount must be a valid redemption block",
            );
        }

        return (amount / LOYALTY_REDEEM_VND_PER_BLOCK) * LOYALTY_REDEEM_POINTS_PER_BLOCK;
    }
}

export default LoyaltyModuleService;
