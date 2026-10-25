import { retrieveOrder } from '@lib/data/orders'
import OrderCompletedTemplate from '@modules/order/templates/order-completed-template'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { retrieveCustomerNextTier } from '@lib/data/customer'
import LoyaltyPointsEarnedToast from '@modules/order/components/loyalty-points-earned-toast'

export const metadata: Metadata = {
    title: 'Order Confirmed',
    description: 'You purchase was successful',
}

type Props = {
    params: Promise<{ id: string; countryCode: string }>
    searchParams: Promise<{ loyalty_points?: string }>
}

export default async function OrderConfirmedPage(props: Props) {
    const params = await props.params
    const searchParams = await props.searchParams
    const order = await retrieveOrder(params.id).catch(() => null)
    const tierData = await retrieveCustomerNextTier(params.countryCode).catch(
        () => null
    )

    if (!order) {
        return notFound()
    }

    const earnedPoints = Number(searchParams.loyalty_points ?? 0)

    return (
        <>
            <LoyaltyPointsEarnedToast points={earnedPoints} />
            <OrderCompletedTemplate order={order} tierData={tierData} />
        </>
    )
}
