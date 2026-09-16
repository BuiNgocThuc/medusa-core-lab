import { NextRequest, NextResponse } from "next/server"
import { placeOrder } from "@lib/data/cart"
import { setCartId } from "@lib/data/cookies"
import { unstable_rethrow } from "next/navigation"

export async function GET(req: NextRequest) {
  const { origin, searchParams } = req.nextUrl
  const cartId = searchParams.get("cart_id")
  const countryCode = searchParams.get("country_code")
  const prefix = countryCode ? `/${countryCode}` : ""
  const resultCode = searchParams.get("resultCode")
  const isMockSuccess =
    searchParams.get("momo_mock") === "1" && resultCode === "0" && cartId

  if (isMockSuccess) {
    try {
      await setCartId(cartId)
      await placeOrder(cartId)
    } catch (error) {
      unstable_rethrow(error)

      return NextResponse.redirect(`${origin}${prefix}/cart?error=order_failed`)
    }
  }

  const target =
    resultCode === "0"
      ? `${origin}${prefix}/checkout?step=review&momo_return=success`
      : `${origin}${prefix}/checkout?step=payment&momo_return=failed`

  return NextResponse.redirect(target)
}
