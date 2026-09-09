import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { retrieveLoyaltyProfile } from "@lib/data/loyalty"
import CartTemplate from "@modules/cart/templates"
import { Metadata } from "next"
import { notFound } from "next/navigation"

export const metadata: Metadata = {
  title: "Cart",
  description: "View your cart",
}

export default async function Cart() {
  const cart = await retrieveCart().catch((error) => {
    console.error(error)
    return notFound()
  })

  const customer = await retrieveCustomer()
  const loyaltyProfile = await retrieveLoyaltyProfile()

  return (
    <CartTemplate
      cart={cart}
      customer={customer}
      loyaltyProfile={loyaltyProfile}
    />
  )
}
