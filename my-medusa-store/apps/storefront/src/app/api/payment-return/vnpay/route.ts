import { placeOrder } from "@lib/data/cart"
import { unstable_rethrow } from "next/navigation"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const { origin, searchParams } = req.nextUrl
  const countryCode = searchParams.get("country_code")
  const prefix = countryCode ? `/${countryCode}` : ""
  const responseCode = searchParams.get("vnp_ResponseCode")
  const transactionStatus = searchParams.get("vnp_TransactionStatus")
  const paymentSucceeded = responseCode === "00" && transactionStatus === "00"

  if (paymentSucceeded) {
    const processed = await processVnpayReturn(searchParams)

    if (processed) {
      try {
        await placeOrder()
      } catch (error) {
        unstable_rethrow(error)
        return NextResponse.redirect(
          `${origin}${prefix}/checkout?step=review&vnpay_return=success`
        )
      }
    } else {
      return NextResponse.redirect(
        `${origin}${prefix}/checkout?step=payment&vnpay_return=failed`
      )
    }
  }

  return NextResponse.redirect(
    `${origin}${prefix}/checkout?step=payment&vnpay_return=failed`
  )
}

async function processVnpayReturn(searchParams: URLSearchParams) {
  const backendUrl = getMedusaBackendUrl()

  if (!backendUrl) {
    return false
  }

  try {
    const hookUrl = new URL("/hooks/payment/vnpay", backendUrl)

    searchParams.forEach((value, key) => {
      hookUrl.searchParams.set(key, value)
    })

    const response = await fetch(hookUrl, {
      method: "GET",
      cache: "no-store",
    })
    const result = (await response.json().catch(() => null)) as {
      RspCode?: string
    } | null

    return response.ok && (result?.RspCode === "00" || result?.RspCode === "02")
  } catch {
    return false
  }
}

function getMedusaBackendUrl() {
  return (
    process.env.MEDUSA_BACKEND_URL ||
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
    ""
  )
}
