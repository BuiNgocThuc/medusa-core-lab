import { Metadata } from 'next'

import Overview from '@modules/account/components/overview'
import { notFound } from 'next/navigation'
import {
    getLoyaltyPoints,
    retrieveCustomer,
    retrieveCustomerNextTier,
} from '@lib/data/customer'
import { listOrders } from '@lib/data/orders'

export const metadata: Metadata = {
    title: 'Account',
    description: 'Overview of your account activity.',
}

type Props = {
    params: Promise<{ countryCode: string }>
}

export default async function OverviewTemplate(props: Props) {
    const params = await props.params
    const { countryCode } = params
    const customer = await retrieveCustomer().catch(() => null)
    const orders = (await listOrders().catch(() => null)) || null
    const loyaltyPoints = await getLoyaltyPoints().catch(() => null)
    const tierData = await retrieveCustomerNextTier(countryCode).catch(
        () => null
    )

    if (!customer) {
        notFound()
    }

    return (
        <Overview
            customer={customer}
            orders={orders}
            tierData={tierData}
            loyaltyPoints={loyaltyPoints}
        />
    )
}
