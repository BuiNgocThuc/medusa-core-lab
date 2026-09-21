import { placeOrder } from "@lib/data/cart"
import { unstable_rethrow } from "next/navigation"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const { origin, searchParams } = req.nextUrl
  const countryCode = searchParams.get("country_code")
  const prefix = countryCode ? `/${countryCode}` : ""
  const resultCode = searchParams.get("resultCode")

  if (resultCode === "0") {
    try {
      await placeOrder()
    } catch (error) {
      unstable_rethrow(error)
      return NextResponse.redirect(
        `${origin}${prefix}/checkout?step=review&momo_return=success`
      )
    }
  }

  return NextResponse.redirect(
    `${origin}${prefix}/checkout?step=payment&momo_return=failed`
  )
}
