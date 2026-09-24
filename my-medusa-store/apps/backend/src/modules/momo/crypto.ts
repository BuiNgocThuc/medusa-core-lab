import { createHmac, randomBytes, timingSafeEqual } from "crypto"

export function signMomoPayload(rawSignatureData: string, secretKey: string) {
  return createHmac("sha256", secretKey)
    .update(rawSignatureData)
    .digest("hex")
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

export function randomMomoId(prefix: string, length = 18) {
  return `${prefix}${randomBytes(length).toString("hex")}`
}

export function buildCreatePaymentSignatureData(input: {
  accessKey: string
  amount: number
  extraData: string
  ipnUrl: string
  orderId: string
  orderInfo: string
  partnerCode: string
  redirectUrl: string
  requestId: string
  requestType: string
}) {
  return [
    `accessKey=${input.accessKey}`,
    `amount=${input.amount}`,
    `extraData=${input.extraData}`,
    `ipnUrl=${input.ipnUrl}`,
    `orderId=${input.orderId}`,
    `orderInfo=${input.orderInfo}`,
    `partnerCode=${input.partnerCode}`,
    `redirectUrl=${input.redirectUrl}`,
    `requestId=${input.requestId}`,
    `requestType=${input.requestType}`,
  ].join("&")
}

export function buildIpnSignatureData(input: {
  accessKey: string
  amount: number | string
  extraData: string
  message: string
  orderId: string
  orderInfo: string
  orderType: string
  partnerCode: string
  payType: string
  requestId: string
  responseTime: number | string
  resultCode: number | string
  transId: number | string
}) {
  return [
    `accessKey=${input.accessKey}`,
    `amount=${input.amount}`,
    `extraData=${input.extraData}`,
    `message=${input.message}`,
    `orderId=${input.orderId}`,
    `orderInfo=${input.orderInfo}`,
    `orderType=${input.orderType}`,
    `partnerCode=${input.partnerCode}`,
    `payType=${input.payType}`,
    `requestId=${input.requestId}`,
    `responseTime=${input.responseTime}`,
    `resultCode=${input.resultCode}`,
    `transId=${input.transId}`,
  ].join("&")
}

export function buildQuerySignatureData(input: {
  accessKey: string
  orderId: string
  partnerCode: string
  requestId: string
}) {
  return [
    `accessKey=${input.accessKey}`,
    `orderId=${input.orderId}`,
    `partnerCode=${input.partnerCode}`,
    `requestId=${input.requestId}`,
  ].join("&")
}

export function buildRefundSignatureData(input: {
  accessKey: string
  amount: number
  description: string
  orderId: string
  partnerCode: string
  requestId: string
  transId: number | string
}) {
  return [
    `accessKey=${input.accessKey}`,
    `amount=${input.amount}`,
    `description=${input.description}`,
    `orderId=${input.orderId}`,
    `partnerCode=${input.partnerCode}`,
    `requestId=${input.requestId}`,
    `transId=${input.transId}`,
  ].join("&")
}
