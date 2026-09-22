import { createHmac, randomBytes, timingSafeEqual } from "crypto"

export function signVnpayPayload(payload: string, hashSecret: string) {
  return createHmac("sha512", hashSecret).update(payload, "utf8").digest("hex")
}

export function buildVnpaySignData(params: Record<string, string | number>) {
  const searchParams = new URLSearchParams()

  for (const key of Object.keys(params).sort()) {
    const value = params[key]

    if (value !== undefined && value !== null && value !== "") {
      searchParams.append(key, String(value))
    }
  }

  return searchParams.toString()
}

export function withoutVnpayHashParams(
  params: Record<string, string | number | undefined>
) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([key, value]) =>
        key !== "vnp_SecureHash" &&
        key !== "vnp_SecureHashType" &&
        value !== undefined &&
        value !== null &&
        value !== ""
    )
  ) as Record<string, string>
}

export function verifyVnpaySignature(
  payload: Record<string, string | undefined>,
  hashSecret: string
) {
  const secureHash = payload.vnp_SecureHash

  if (!secureHash) {
    return false
  }

  const signData = buildVnpaySignData(withoutVnpayHashParams(payload))
  const expectedSignature = signVnpayPayload(signData, hashSecret)

  return timingSafeStringEqual(secureHash.toLowerCase(), expectedSignature)
}

export function timingSafeStringEqual(left?: string, right?: string) {
  if (!left || !right) {
    return false
  }

  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  )
}

export function randomVnpayTxnRef(prefix = "VNP", length = 12) {
  return `${prefix}${randomBytes(length).toString("hex").toUpperCase()}`
}

export function buildVnpayRefundSignatureData(input: {
  requestId: string
  version: string
  command: string
  tmnCode: string
  transactionType: string
  txnRef: string
  amount: number
  transactionNo: string
  transactionDate: string
  createBy: string
  createDate: string
  ipAddress: string
  orderInfo: string
}) {
  return [
    input.requestId,
    input.version,
    input.command,
    input.tmnCode,
    input.transactionType,
    input.txnRef,
    input.amount,
    input.transactionNo,
    input.transactionDate,
    input.createBy,
    input.createDate,
    input.ipAddress,
    input.orderInfo,
  ].join("|")
}

export function formatVnpayDate(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })

  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  )

  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`
}
