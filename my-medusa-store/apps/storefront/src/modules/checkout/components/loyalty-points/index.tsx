'use client'

import { HttpTypes } from '@medusajs/types'
import React, { useEffect, useMemo, useState } from 'react'
import { getLoyaltyPoints } from '@lib/data/customer'
import { Button, Heading } from '@medusajs/ui'
import Link from 'next/link'
import {
    applyLoyaltyPointsOnCart,
    removeLoyaltyPointsOnCart,
} from '@lib/data/cart'

type LoyaltyPointsProps = {
    cart: HttpTypes.StoreCart
}
const LoyaltyPoints = ({ cart }: LoyaltyPointsProps) => {
    const isLoyaltyPointsPromoApplied = useMemo(() => {
        return (
            cart.promotions.find(
                (promo) => promo.id === cart.metadata?.loyalty_promo_id
            ) !== undefined
        )
    }, [cart])
    const [loyaltyPoints, setLoyaltyPoints] = useState<number | null>(null)
    const [pointsToRedeem, setPointsToRedeem] = useState(100)

    useEffect(() => {
        getLoyaltyPoints().then((points) => {
            console.log(points)
            setLoyaltyPoints(points)
        })
    }, [])

    const handleTogglePromotion = async (
        e: React.MouseEvent<HTMLButtonElement, MouseEvent>
    ) => {
        e.preventDefault()
        if (!isLoyaltyPointsPromoApplied) {
            await applyLoyaltyPointsOnCart(pointsToRedeem)
        } else {
            await removeLoyaltyPointsOnCart()
        }
    }

    return (
        <>
            <div className="h-px w-full border-b border-gray-200 my-4" />
            <div className="flex flex-col">
                <Heading className="txt-medium mb-2">Loyalty Points</Heading>
                {loyaltyPoints === null && (
                    <Link
                        href="/account"
                        className="txt-medium text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
                    >
                        Sign up to get and use loyalty points
                    </Link>
                )}
                {loyaltyPoints !== null && (
                    <div className="flex items-center justify-between my-6 gap-1">
                        {!isLoyaltyPointsPromoApplied && (
                            <input
                                aria-label="Loyalty points to redeem"
                                className="w-1/4 rounded border p-2"
                                min={100}
                                step={100}
                                type="number"
                                value={pointsToRedeem}
                                onChange={(event) => setPointsToRedeem(Number(event.target.value))}
                            />
                        )}
                        <Button
                            variant="secondary"
                            className="w-1/2"
                            onClick={handleTogglePromotion}
                        >
                            {isLoyaltyPointsPromoApplied ? 'Remove' : 'Apply'}{' '}
                            Loyalty Points
                        </Button>
                        <span className="txt-medium text-ui-fg-subtle">
                            You have {loyaltyPoints} loyalty points
                        </span>
                    </div>
                )}
            </div>
        </>
    )
}

export default LoyaltyPoints
