import { retrieveOrder } from '@lib/data/orders'
import OrderCompletedTemplate from '@modules/order/templates/order-completed-template'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { retrieveCustomerNextTier } from '@lib/data/customer'

export const metadata: Metadata = {
    title: 'Order Confirmed',
    description: 'You purchase was successful',
}

type Props = {
    params: Promise<{ id: string; countryCode: string }>
}

export default async function OrderConfirmedPage(props: Props) {
    const params = await props.params
    const order = await retrieveOrder(params.id).catch(() => null)
    const tierData = await retrieveCustomerNextTier(params.countryCode).catch(
        () => null
    )

    if (!order) {
        return notFound()
    }

    return <OrderCompletedTemplate order={order} tierData={tierData} />
}
