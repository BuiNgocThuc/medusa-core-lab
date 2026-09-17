import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const { origin, searchParams } = req.nextUrl
  const countryCode = searchParams.get("country_code")
  const prefix = countryCode ? `/${countryCode}` : ""
  const resultCode = searchParams.get("resultCode")

  const target =
    resultCode === "0"
      ? `${origin}${prefix}/checkout?step=review&momo_return=success`
      : `${origin}${prefix}/checkout?step=payment&momo_return=failed`

  return NextResponse.redirect(target)
}
