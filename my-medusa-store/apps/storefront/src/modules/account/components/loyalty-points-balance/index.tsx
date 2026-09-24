'use client'

import { getLoyaltyPoints } from '@lib/data/customer'
import { useEffect, useState } from 'react'

type LoyaltyPointsBalanceProps = {
    points: number | null
}

const LoyaltyPointsBalance = ({ points }: LoyaltyPointsBalanceProps) => {
    const [balance, setBalance] = useState(points)
    const [loadFailed, setLoadFailed] = useState(false)

    useEffect(() => {
        setBalance(points)

        if (points !== null) {
            setLoadFailed(false)
            return
        }

        getLoyaltyPoints()
            .then((value) => {
                setBalance(value)
                setLoadFailed(false)
            })
            .catch(() => {
                setLoadFailed(true)
            })
    }, [points])

    return (
        <section
            className="rounded-lg border border-gray-200 bg-gray-50 p-6"
            data-testid="profile-loyalty-points"
        >
            <h2 className="text-large-semi">Loyalty points</h2>
            {balance === null ? (
                <p className="mt-2 text-small-regular text-ui-fg-subtle">
                    {loadFailed
                        ? 'Không thể tải số dư loyalty points. Vui lòng đăng nhập lại.'
                        : 'Đang tải số dư loyalty points...'}
                </p>
            ) : (
                <>
                    <p
                        className="mt-3 text-3xl-semi"
                        data-testid="profile-loyalty-points-value"
                        data-value={balance}
                    >
                        {balance.toLocaleString('vi-VN')} points
                    </p>
                    <p className="mt-2 text-small-regular text-ui-fg-subtle">
                        1 point = 500 ₫ discount khi checkout.
                    </p>
                </>
            )}
        </section>
    )
}

export default LoyaltyPointsBalance
