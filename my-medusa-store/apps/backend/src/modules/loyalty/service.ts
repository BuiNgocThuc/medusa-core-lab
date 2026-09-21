import { MedusaError, MedusaService } from "@medusajs/framework/utils";
import LoyaltyPoint from "./models/loyalty-point";
import { LoyaltyReservation, LoyaltyTransaction } from "./models";
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
    LoyaltyReservation,
}) {
    async reservePointsForCart(input: {
        customer_id: string
        cart_id: string
        promotion_id: string
        points: number
        expires_at: Date
    }) {
        const reservations = await this.listLoyaltyReservations({
            customer_id: input.customer_id,
            state: "reserved",
        })
        const now = new Date()
        const reservedByOtherCarts = reservations
            .filter((reservation) => reservation.cart_id !== input.cart_id && reservation.expires_at > now)
            .reduce((sum, reservation) => sum + reservation.points, 0)
        const balance = await this.getPoints(input.customer_id)
        if (balance - reservedByOtherCarts < input.points) {
            throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Không đủ điểm tích lũy khả dụng")
        }

        const [existing] = await this.listLoyaltyReservations({ cart_id: input.cart_id })
        if (existing) {
            return await this.updateLoyaltyReservations({
                id: existing.id,
                promotion_id: input.promotion_id,
                points: input.points,
                state: "reserved",
                expires_at: input.expires_at,
                order_id: null,
            })
        }
        return await this.createLoyaltyReservations(input)
    }

    async releaseReservation(cartId: string, state: "released" | "expired" = "released") {
        const [reservation] = await this.listLoyaltyReservations({ cart_id: cartId })
        if (!reservation || reservation.state !== "reserved") return reservation
        return await this.updateLoyaltyReservations({ id: reservation.id, state })
    }

    async consumeReservationForOrder(input: {
        order_id: string
        customer_id: string
        cart_id: string
        promotion_id: string
        points: number
    }) {
        const [existingTransaction] = await this.listLoyaltyTransactions({
            order_id: input.order_id,
            type: "deduct",
        })
        if (existingTransaction) return { skipped: true, transaction: existingTransaction }

        const [reservation] = await this.listLoyaltyReservations({ cart_id: input.cart_id })
        if (
            !reservation || reservation.customer_id !== input.customer_id ||
            reservation.promotion_id !== input.promotion_id || reservation.points !== input.points ||
            reservation.state !== "reserved" || reservation.expires_at <= new Date()
        ) {
            throw new MedusaError(MedusaError.Types.INVALID_DATA, "Loyalty reservation không hợp lệ")
        }
        await this.deductPoints(input.customer_id, input.points)
        const transaction = await this.createLoyaltyTransactions({
            customer_id: input.customer_id,
            type: "deduct",
            reference_id: input.order_id,
            points: -input.points,
            order_id: input.order_id,
            cart_id: input.cart_id,
            promotion_id: input.promotion_id,
        })
        await this.updateLoyaltyReservations({
            id: reservation.id,
            state: "consumed",
            order_id: input.order_id,
        })
        return { skipped: false, transaction }
    }
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
