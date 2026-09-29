/**
 * Webhook nhận callback hỗ trợ / khiếu nại (Ticket Webhook) từ GHN
 * Endpoint: POST /webhooks/ghn/ticket
 * Tài liệu: https://developer.ghn.dev/vi/docs/webhook/callback-ticket
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export interface GhnTicketWebhookPayload {
  TicketId: number
  ClientID: string
  OrderCode: string
  Type: string
  Status: string
  StatusID: number
  Description: string
  CreatedBy: number
  CreatedAt: string
  UpdatedAt: string
  Attachments?: any[]
  Conversations?: Array<{
    Body: string
    FromEmail: string
    UserId: number
    Private: boolean
    CcEmails?: string[] | null
    BccEmails?: string[] | null
    Attachments?: any[]
    CreatedAt: string
    UpdatedAt: string
  }>
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  // 1. Xác thực bảo mật qua Header tùy chỉnh (Secret Key)
  const webhookSecret = process.env.GHN_WEBHOOK_SECRET
  if (webhookSecret) {
    const receivedSecret =
      req.headers["x-ghn-secret"] ||
      req.headers["x-webhook-secret"] ||
      (req.headers["authorization"]?.startsWith("Bearer ")
        ? req.headers["authorization"].slice(7)
        : req.headers["authorization"])

    if (!receivedSecret || receivedSecret !== webhookSecret) {
      logger.warn(
        `[GHN Ticket Webhook] Unauthorized request received. Invalid or missing secret header.`
      )
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Invalid or missing webhook secret",
      })
    }
  }

  const payload = req.body as GhnTicketWebhookPayload
  const { TicketId, OrderCode, Type, Status, StatusID, Description } = payload || {}

  logger.info(
    `[GHN Ticket Webhook] TicketId: ${TicketId} | OrderCode: ${OrderCode} | Type: ${Type} | Status: ${Status} (ID: ${StatusID}) | Description: ${Description}`
  )

  // TODO: Nếu hệ thống có module CSKH / Ticket thì lưu trữ hoặc thông báo cho admin
  return res.status(200).json({
    success: true,
    message: "GHN ticket webhook processed successfully",
  })
}
