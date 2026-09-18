import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const { origin, searchParams } = req.nextUrl
  const countryCode = searchParams.get("country_code")
  const prefix = countryCode ? `/${countryCode}` : ""
  const responseCode = searchParams.get("vnp_ResponseCode")
  const transactionStatus = searchParams.get("vnp_TransactionStatus")

  const target =
    responseCode === "00" && transactionStatus === "00"
      ? `${origin}${prefix}/checkout?step=review&vnpay_return=success`
      : `${origin}${prefix}/checkout?step=payment&vnpay_return=failed`

  return NextResponse.redirect(target)
}
