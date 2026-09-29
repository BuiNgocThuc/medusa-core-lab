/**
 * Webhook nhận callback trạng thái đơn hàng từ GHN (Order Webhook)
 * Endpoint: POST /webhooks/ghn/order
 * Tài liệu: https://developer.ghn.dev/vi/docs/webhook/callback-order-status
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { markOrderFulfillmentAsDeliveredWorkflow } from "@medusajs/medusa/core-flows"

export interface GhnOrderWebhookPayload {
  ShopID: number
  Time: string
  OrderCode: string
  ClientOrderCode?: string
  Type: string
  Description: string
  Status: string
  Reason?: string
  ReasonCode?: string
  CODAmount?: number
  CODTransferDate?: string | null
  Weight?: number
  ConvertedWeight?: number
  Length?: number
  Width?: number
  Height?: number
  PaymentType?: number
  IsPartialReturn?: boolean
  PartialReturnCode?: string
  Fee?: Record<string, any>
  TotalFee?: number
  Warehouse?: string
  ShipperName?: string
  ShipperPhone?: string
  PodURL?: string
}

import {
  GhnOrderStatus,
  GHN_TERMINAL_STATUSES,
  resolveFulfillmentLifecycle,
} from "../../../../modules/giao-hang-nhanh/types"

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
        `[GHN Webhook] Unauthorized request received. Invalid or missing secret header.`
      )
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Invalid or missing webhook secret",
      })
    }
  }

  const payload = req.body as GhnOrderWebhookPayload
  const {
    OrderCode,
    ClientOrderCode,
    Status,
    Type,
    Description,
    ShipperName,
    ShipperPhone,
    PodURL,
    Warehouse,
    TotalFee,
    CODAmount,
  } = payload || {}

  if (!OrderCode && !ClientOrderCode) {
    logger.warn(`[GHN Webhook] Received payload without OrderCode or ClientOrderCode: ${JSON.stringify(payload)}`)
    return res.status(200).json({ success: true, message: "Ignored: Missing order identification" })
  }

  logger.info(
    `[GHN Webhook] OrderCode: ${OrderCode} | ClientOrderCode: ${ClientOrderCode || "N/A"} | Type: ${Type} (${Description}) | Status: ${Status}`
  )

  // Phân tích trạng thái sự kiện qua Lifecycle Resolver chuẩn hóa
  const lifecycle = resolveFulfillmentLifecycle(Status, payload?.Time)

  try {
    const fulfillmentModule = req.scope.resolve(Modules.FULFILLMENT)

    // Tìm fulfillment tương ứng theo OrderCode trong data hoặc label tracking
    const fulfillments = await fulfillmentModule.listFulfillments({
      // Lấy danh sách fulfillment gần đây để tìm khớp ghn_order_code
    }, {
      take: 50,
      order: { created_at: "DESC" },
    })

    const matchedFulfillment = fulfillments.find(
      (f: any) =>
        f.data?.ghn_order_code === OrderCode ||
        f.labels?.some((l: any) => l.tracking_number === OrderCode) ||
        (ClientOrderCode && (
          f.data?.client_order_code === ClientOrderCode ||
          f.order_id === ClientOrderCode ||
          f.id === ClientOrderCode ||
          (f.id && ClientOrderCode.includes(f.id.replace(/^ful_/, "").slice(-8)))
        ))
    )

    // Cờ quyết định có cập nhật ghn_status chính của đơn hàng hay không
    let shouldUpdateMainStatus = true

    if (matchedFulfillment) {
      const existingData = (matchedFulfillment.data as Record<string, any>) || {}

      // =========================================================================
      // NGUYÊN TẮC 1: KHỬ TRÙNG LẶP SỰ KIỆN (IDEMPOTENCY THEO GHN DOCS)
      // Khử trùng theo bộ 3: OrderCode + Type + Time
      // Nếu GHN retry gửi lại đúng cùng 1 gói tin sự kiện đã xử lý -> Bỏ qua ngay, trả HTTP 200.
      // =========================================================================
      const isDuplicateEvent = (existingData.ghn_events_log || []).some(
        (ev: any) =>
          ev.type === Type &&
          ev.time === payload.Time
      )

      if (isDuplicateEvent) {
        logger.info(
          `[GHN Webhook] Ignored duplicate event: OrderCode=${OrderCode}, Type=${Type}, Time=${payload.Time}`
        )
        return res.status(200).json({
          success: true,
          message: "Duplicate event acknowledged (idempotent)",
        })
      }

      // =========================================================================
      // NGUYÊN TẮC 2: CHỐNG LÙI TRẠNG THÁI (OUT-OF-ORDER & STATUS MONOTONICITY)
      // Giải quyết vấn đề mạng lag khiến sự kiện quá khứ (Type khác) bay tới sau sự kiện tương lai:
      // a) So sánh incoming_time với last_status_time của đơn hàng:
      //    Nếu incoming_time < last_status_time -> Đây là callback bị trễ (delayed event).
      // b) Kiểm tra trạng thái cuối cùng (Terminal State):
      //    Nếu đơn đã 'delivered' (giao thành công) hoặc 'cancel' -> Không cho phép lùi trạng thái.
      // => Không cập nhật đè ghn_status chính, nhưng VẪN GHI LOG lịch sử để soi audit.
      // =========================================================================
      const incomingTime = payload.Time ? new Date(payload.Time).getTime() : Date.now()
      const lastStatusTimeStr = existingData.ghn_last_update
      const lastStatusTime = lastStatusTimeStr ? new Date(lastStatusTimeStr).getTime() : 0

      const isStaleEvent = lastStatusTime > 0 && incomingTime < lastStatusTime
      const isAlreadyTerminal = GHN_TERMINAL_STATUSES.has(existingData.ghn_status)

      shouldUpdateMainStatus = !isStaleEvent && !isAlreadyTerminal

      if (!shouldUpdateMainStatus) {
        logger.warn(
          `[GHN Webhook] Preserving main status "${existingData.ghn_status}". Incoming event "${Status}" at ${payload.Time} will not overwrite main status (isStale=${isStaleEvent}, isTerminal=${isAlreadyTerminal}). History log will still be appended.`
        )
      }

      const updatedData = {
        ...existingData,
        ghn_status: shouldUpdateMainStatus ? Status : existingData.ghn_status,
        ghn_last_update: shouldUpdateMainStatus ? payload.Time : existingData.ghn_last_update,
        ghn_shipper_name: shouldUpdateMainStatus ? (ShipperName || existingData.ghn_shipper_name) : existingData.ghn_shipper_name,
        ghn_shipper_phone: shouldUpdateMainStatus ? (ShipperPhone || existingData.ghn_shipper_phone) : existingData.ghn_shipper_phone,
        ghn_pod_url: shouldUpdateMainStatus ? (PodURL || existingData.ghn_pod_url) : existingData.ghn_pod_url,
        ghn_warehouse: shouldUpdateMainStatus ? (Warehouse || existingData.ghn_warehouse) : existingData.ghn_warehouse,
        ghn_total_fee: TotalFee !== undefined ? TotalFee : existingData.ghn_total_fee,
        ghn_cod_amount: CODAmount !== undefined ? CODAmount : existingData.ghn_cod_amount,
        ghn_events_log: [
          ...(existingData.ghn_events_log || []),
          {
            type: Type,
            status: Status,
            description: Description,
            time: payload.Time,
            shipper: ShipperName ? `${ShipperName} (${ShipperPhone})` : undefined,
            is_stale: isStaleEvent ? true : undefined,
          },
        ].slice(-20), // Giữ tối đa 20 log gần nhất
      }

      const fulfillmentUpdates: Record<string, any> = {
        data: updatedData,
      }

      // 1. Cập nhật shipped_at nếu kiện hàng đã rời kho và chưa có shipped_at
      if (lifecycle.isShipped && !matchedFulfillment.shipped_at) {
        fulfillmentUpdates.shipped_at = lifecycle.eventTime
      }

      // 2. Cập nhật delivered_at nếu giao hàng thành công và chưa có delivered_at
      if (lifecycle.isDelivered && shouldUpdateMainStatus && !matchedFulfillment.delivered_at) {
        fulfillmentUpdates.delivered_at = lifecycle.eventTime
      }

      // 3. Cập nhật canceled_at nếu đơn bị hủy
      if (lifecycle.isCanceled && shouldUpdateMainStatus && !matchedFulfillment.canceled_at) {
        fulfillmentUpdates.canceled_at = lifecycle.eventTime
      }

      await fulfillmentModule.updateFulfillment(matchedFulfillment.id, fulfillmentUpdates)

      logger.info(
        `[GHN Webhook] Successfully updated fulfillment ${matchedFulfillment.id} (main status: "${updatedData.ghn_status}")`
      )
    } else {
      logger.info(
        `[GHN Webhook] No matching fulfillment found for OrderCode: ${OrderCode}. Event logged.`
      )
    }

    // Đồng bộ trực tiếp vào Order metadata để hiển thị trên Storefront và Admin
    try {
      const orderModule = req.scope.resolve(Modules.ORDER) as any
      let targetOrderId = (matchedFulfillment as any)?.order_id

      if (!targetOrderId && ClientOrderCode) {
        if (ClientOrderCode.startsWith("ORD-")) {
          // Xử lý cả dạng ORD-1001 và dạng có suffix ORD-1001-A1B2C3D4 (cho partial fulfillments)
          const rawId = ClientOrderCode.replace(/^ORD-/, "").split("-")[0]
          const displayId = Number(rawId)
          if (!isNaN(displayId)) {
            const foundOrders = await orderModule.listOrders({ display_id: displayId })
            if (foundOrders && foundOrders.length > 0) {
              targetOrderId = foundOrders[0].id
            }
          }
        } else if (ClientOrderCode.startsWith("order_")) {
          targetOrderId = ClientOrderCode
        }
      }

      if (targetOrderId && shouldUpdateMainStatus) {
        // Kích hoạt workflow giao hàng thành công của Medusa nếu sự kiện là delivered
        if (lifecycle.isDelivered && matchedFulfillment?.id) {
          try {
            await markOrderFulfillmentAsDeliveredWorkflow(req.scope).run({
              input: {
                orderId: targetOrderId,
                fulfillmentId: matchedFulfillment.id,
              },
            })
          } catch (wfErr: any) {
            logger.warn(
              `[GHN Webhook] Notice: markOrderFulfillmentAsDeliveredWorkflow (${wfErr?.message})`
            )
          }
        }

        const order = await orderModule.retrieveOrder(targetOrderId)
        const currentMeta = (order.metadata as Record<string, any>) || {}
        await orderModule.updateOrders(targetOrderId, {
          metadata: {
            ...currentMeta,
            ghn_order_code: OrderCode,
            ghn_status: Status,
            ghn_status_description: Description,
            ghn_shipper_name: ShipperName || currentMeta.ghn_shipper_name,
            ghn_shipper_phone: ShipperPhone || currentMeta.ghn_shipper_phone,
            ghn_pod_url: PodURL || currentMeta.ghn_pod_url,
            ghn_last_update: payload.Time,
          },
        })
        logger.info(
          `[GHN Webhook] Successfully synced order ${targetOrderId} metadata: ghn_status="${Status}"`
        )
      } else if (targetOrderId && !shouldUpdateMainStatus) {
        logger.info(
          `[GHN Webhook] Preserved order ${targetOrderId} main metadata (skipped overwriting main status with older/terminal event).`
        )
      }
    } catch (orderErr: any) {
      logger.warn(
        `[GHN Webhook] Notice: Could not sync order metadata (${orderErr?.message})`
      )
    }
  } catch (error: any) {
    logger.error(
      `[GHN Webhook] Error updating fulfillment for OrderCode ${OrderCode}: ${error?.message}`,
      error?.stack
    )
    // Vẫn trả về 200 để tránh GHN retry liên tục làm nghẽn hàng đợi webhook theo quy định của GHN
  }

  return res.status(200).json({
    success: true,
    message: "GHN order webhook processed successfully",
  })
}
