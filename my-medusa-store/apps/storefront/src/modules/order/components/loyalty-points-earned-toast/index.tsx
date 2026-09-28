'use client'

import { useToast } from '@modules/common/components/toast'
import { useEffect } from 'react'

type LoyaltyPointsEarnedToastProps = {
    points: number
}

export default function LoyaltyPointsEarnedToast({
    points,
}: LoyaltyPointsEarnedToastProps) {
    const { showToast } = useToast()

    useEffect(() => {
        if (!Number.isFinite(points) || points <= 0) {
            return
        }

        showToast({
            content: `Bạn đã nhận ${points.toLocaleString('vi-VN')} điểm loyalty.`,
            type: 'success',
            duration: 5000,
        })

        window.history.replaceState(null, '', window.location.pathname)
    }, [points, showToast])

    return null
}
