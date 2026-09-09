import { Metadata } from "next"

import Overview from "@modules/account/components/overview"
import { notFound } from "next/navigation"
import { retrieveCustomer } from "@lib/data/customer"
import { retrieveLoyaltyProfile } from "@lib/data/loyalty"
import { listOrders } from "@lib/data/orders"

export const metadata: Metadata = {
  title: "Account",
  description: "Overview of your account activity.",
}

export default async function OverviewTemplate() {
  const customer = await retrieveCustomer().catch(() => null)
  const orders = (await listOrders().catch(() => null)) || null
  const loyaltyProfile = await retrieveLoyaltyProfile()

  if (!customer) {
    notFound()
  }

  return (
    <Overview
      customer={customer}
      orders={orders}
      loyaltyProfile={loyaltyProfile}
    />
  )
}
