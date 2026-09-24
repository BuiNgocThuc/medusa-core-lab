'use client'

import {
    applyLoyaltyPointsOnCart,
    removeLoyaltyPointsOnCart,
} from '@lib/data/cart'
import { getLoyaltyPoints } from '@lib/data/customer'
import { Button, Heading } from '@medusajs/ui'
import { HttpTypes } from '@medusajs/types'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const VND_PER_POINT = 500
const formatVnd = (amount: number) => `${amount.toLocaleString('vi-VN')} ₫`

type LoyaltyPointsProps = { cart: HttpTypes.StoreCart }

type RedeemFormProps = {
    availablePoints: number
    pointsToRedeem: number
    maxPoints: number
    discount: number
    isSubmitting: boolean
    onPointsChange: (points: number) => void
    onApply: () => void
}

const LoyaltyAppliedCard = ({
    isSubmitting,
    onRemove,
}: {
    isSubmitting: boolean
    onRemove: () => void
}) => (
    <div className="mt-4 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-4">
        <span className="text-sm text-green-900">Loyalty discount applied</span>
        <Button
            variant="secondary"
            size="small"
            disabled={isSubmitting}
            onClick={onRemove}
        >
            {isSubmitting ? 'Removing...' : 'Remove'}
        </Button>
    </div>
)

const LoyaltyRedeemForm = ({
    availablePoints,
    pointsToRedeem,
    maxPoints,
    discount,
    isSubmitting,
    onPointsChange,
    onApply,
}: RedeemFormProps) => (
    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Available points</span>
            <strong>{availablePoints.toLocaleString()}</strong>
        </div>
        <label
            className="mt-4 block text-sm font-medium"
            htmlFor="loyalty-points"
        >
            Points to redeem
        </label>
        <div className="mt-2 flex items-center gap-2">
            <input
                id="loyalty-points"
                type="number"
                min="1"
                max={maxPoints}
                step="1"
                value={pointsToRedeem || ''}
                onChange={(event) => onPointsChange(Number(event.target.value))}
                className="h-10 min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none transition-colors focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
            />

            <Button
                type="button"
                variant="secondary"
                size="small"
                disabled={!maxPoints || isSubmitting}
                onClick={() => onPointsChange(maxPoints)}
                className="h-10 shrink-0 cursor-pointer rounded-md border outline-0 border-gray-300 bg-white px-3 text-sm font-medium shadow-sm transition-colors hover:border-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
                Max
            </Button>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-gray-600">Discount</span>
            <strong>{formatVnd(discount)}</strong>
        </div>
        <p className="mt-1 text-xs text-gray-500">
            You can use up to {maxPoints.toLocaleString()} points on this order.
        </p>
        <Button
            type="button"
            disabled={!pointsToRedeem || isSubmitting}
            onClick={onApply}
            className="mt-4 h-10 w-full cursor-pointer rounded-md px-4 text-sm font-semibold shadow-sm transition-colors hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
            {isSubmitting
                ? 'Applying...'
                : pointsToRedeem
                ? `Apply ${pointsToRedeem.toLocaleString()} points`
                : 'Select points to apply'}
        </Button>
    </div>
)

const LoyaltyPoints = ({ cart }: LoyaltyPointsProps) => {
    const router = useRouter()
    const [availablePoints, setAvailablePoints] = useState<number | null>(null)
    const [pointsToRedeem, setPointsToRedeem] = useState(0)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [pointsLoadError, setPointsLoadError] = useState<string | null>(
        null
    )

    const hasAppliedPromotion = (cart.promotions ?? []).some(
        (promotion) => promotion.id === cart.metadata?.loyalty_promo_id
    )
    const [isApplied, setIsApplied] = useState(hasAppliedPromotion)
    const itemAmount = Number(cart.subtotal ?? 0)
    const maxRedeemablePoints = Math.min(
        Math.max(0, availablePoints ?? 0),
        Math.floor(itemAmount / VND_PER_POINT)
    )
    const validPoints = Math.min(
        maxRedeemablePoints,
        Math.max(0, Math.floor(pointsToRedeem))
    )
    const discount = validPoints * VND_PER_POINT

    useEffect(() => {
        let isMounted = true

        getLoyaltyPoints()
            .then((points) => {
                if (!isMounted) return

                const available = Math.max(0, points)
                setAvailablePoints(available)
                setPointsLoadError(null)
                setPointsToRedeem(
                    Math.min(
                        available,
                        Math.floor(itemAmount / VND_PER_POINT)
                    )
                )
            })
            .catch(() => {
                if (!isMounted) return

                setAvailablePoints(null)
                setPointsLoadError(
                    'Không thể tải điểm loyalty. Vui lòng đăng nhập lại.'
                )
            })

        return () => {
            isMounted = false
        }
    }, [itemAmount])

    useEffect(() => {
        setIsApplied(hasAppliedPromotion)
    }, [hasAppliedPromotion])

    const handleApply = async () => {
        if (!validPoints || isSubmitting) return
        setIsSubmitting(true)
        setError(null)
        try {
            await applyLoyaltyPointsOnCart(validPoints)
            setIsApplied(true)
            router.refresh()
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : 'Không thể áp dụng ưu đãi đổi điểm'
            )
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleRemove = async () => {
        if (isSubmitting) return
        setIsSubmitting(true)
        setError(null)
        try {
            await removeLoyaltyPointsOnCart()
            setIsApplied(false)
            router.refresh()
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : 'Không thể gỡ ưu đãi đổi điểm'
            )
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <section className="my-6 border-t border-gray-200 pt-6">
            <Heading className="text-xl font-semibold">Loyalty points</Heading>
            <p className="mt-1 text-sm text-gray-500">
                1 point = 500 ₫ discount
            </p>

            {error && (
                <p className="mt-3 text-sm text-red-600" role="alert">
                    {error}
                </p>
            )}

            {availablePoints === null ? (
                <div className="mt-3">
                    <Link
                        href="/account"
                        className="inline-block text-sm font-medium text-ui-fg-interactive"
                    >
                        Sign in to use loyalty points
                    </Link>
                    {pointsLoadError && (
                        <p className="mt-1 text-sm text-red-600" role="alert">
                            {pointsLoadError}
                        </p>
                    )}
                </div>
            ) : isApplied ? (
                <LoyaltyAppliedCard
                    isSubmitting={isSubmitting}
                    onRemove={handleRemove}
                />
            ) : (
                <LoyaltyRedeemForm
                    availablePoints={availablePoints}
                    pointsToRedeem={validPoints}
                    maxPoints={maxRedeemablePoints}
                    discount={discount}
                    isSubmitting={isSubmitting}
                    onPointsChange={setPointsToRedeem}
                    onApply={handleApply}
                />
            )}
        </section>
    )
}

export default LoyaltyPoints
