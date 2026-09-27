/**
 * Giao Hàng Nhanh (GHN) Fulfillment Provider Service cho Medusa v2
 */
import {
  AbstractFulfillmentProviderService,
  MedusaError,
} from "@medusajs/framework/utils"
import type {
  CalculatedShippingOptionPrice,
  CalculateShippingOptionPriceDTO,
  CreateFulfillmentResult,
  FulfillmentDTO,
  FulfillmentItemDTO,
  FulfillmentOption,
  FulfillmentOrderDTO,
  Logger,
  ValidateFulfillmentDataContext,
} from "@medusajs/framework/types"

import { GhnClient } from "./client"
import type { GhnCreateOrderRequest, GhnModuleOptions, GhnOrderItem } from "./types"

type InjectedDependencies = {
  logger: Logger
}

export class GiaoHangNhanhProviderService extends AbstractFulfillmentProviderService {
  static identifier = "ghn"

  protected readonly logger_: Logger
  protected readonly options_: GhnModuleOptions
  protected readonly client_: GhnClient

  constructor(container: InjectedDependencies, options: GhnModuleOptions) {
    super()

    this.logger_ = container.logger
    this.options_ = {
      endpoint: "https://dev-online-gateway.ghn.vn/shiip/public-api",
      paymentTypeId: 1,
      requiredNote: "CHOXEMHANGKHONGTHU",
      defaultWeight: 500,
      defaultDimensions: {
        length: 10,
        width: 10,
        height: 10,
      },
      ...options,
    }

    this.client_ = new GhnClient(this.options_, this.logger_)
  }

  /**
   * Trả về 1 tùy chọn giao hàng ở cấp Medusa Configuration.
   *
   * Ý nghĩa: "GHN Delivery" là cấu hình Medusa — nó KHÔNG embed service_type_id vì
   * service_type_id là GHN Runtime Data, phụ thuộc vào from_district + to_district + weight.
   * service_type_id sẽ được resolve động tại checkout qua API getAvailableServices().
   *
   * Medusa                              GHN
   * ─────────────────────────────────────────────
   * ghn-delivery   ─────────►  Delivery integration
   *                                    │
   *                                    ▼
   *                             available-services
   *                                    │  (from_district + to_district)
   *                                    ▼
   *                              service_type_id
   *                                ├── 2 (Hàng nhẹ < 20kg)
   *                                └── 5 (Hàng nặng ≥ 20kg)
   *                                    │
   *                                    ▼
   *                               calculate-fee
   */
  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [
      {
        id: "ghn-delivery",
        name: "GHN Delivery",
      },
    ]
  }

  /**
   * Xác thực dữ liệu khi tạo Shipping Option trong Admin
   */
  async validateOption(data: Record<string, unknown>): Promise<boolean> {
    return true
  }

  /**
   * Xác thực và làm giàu dữ liệu shipping method khi khách hàng chọn method.
   * Không cần resolve service_type_id ở đây — nó sẽ được tính tại calculatePrice().
   */
  async validateFulfillmentData(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    context: ValidateFulfillmentDataContext
  ): Promise<any> {
    return { ...data }
  }

  /**
   * Báo cho Medusa biết Provider này có thể tính giá động (Calculated Price)
   */
  async canCalculate(data: any): Promise<boolean> {
    return true
  }

  /**
   * Resolve service_type_id từ danh sách dịch vụ khả dụng của GHN.
   *
   * Logic:
   * 1. Hỏi GHN xem tuyến này hỗ trợ gói nào
   * 2. Nếu hàng nặng (>= 20.000g) → chọn gói service_type_id 5 (Hàng nặng)
   * 3. Nếu hàng nhẹ → chọn gói service_type_id 2 (Hàng nhẹ)
   * 4. Fallback vào gói đầu tiên khả dụng nếu không tìm được mẩu nhỳ
   */
  private async resolveServiceTypeId(
    fromDistrictId: number,
    toDistrictId: number,
    totalWeightGrams: number
  ): Promise<number> {
    const services = await this.client_.getAvailableServices(fromDistrictId, toDistrictId)

    if (!services || services.length === 0) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `[GHN Fulfillment] No GHN service available for route ${fromDistrictId} → ${toDistrictId}. Cannot calculate shipping fee.`
      )
    }

    const isHeavy = totalWeightGrams >= 20_000
    const preferredTypeId = isHeavy ? 5 : 2

    // Tìm đúng gói phù hợp dựa theo cân nặng
    const matched = services.find((s) => s.service_type_id === preferredTypeId)
    if (matched) {
      this.logger_.info?.(
        `[GHN Fulfillment] Resolved service_type_id=${matched.service_type_id} (${matched.short_name}) for weight=${totalWeightGrams}g`
      )
      return matched.service_type_id
    }

    // Fallback: lấy gói đầu tiên khả dụng
    const fallback = services[0]
    this.logger_.warn?.(
      `[GHN Fulfillment] Preferred service_type_id=${preferredTypeId} not found. Falling back to service_type_id=${fallback.service_type_id} (${fallback.short_name})`
    )
    return fallback.service_type_id
  }

  /**
   * Tính phí vận chuyển theo thời gian thực từ GHN API.
   *
   * Flow:
   *   Cart → from_district + to_district + weight
   *     │
   *     ▼
   *   getAvailableServices() → resolve service_type_id
   *     │
   *     ▼
   *   calculateFee() → GHN giá cước thực tế
   *     │
   *     ▼
   *   Medusa calculated_amount
   */
  async calculatePrice(
    optionData: CalculateShippingOptionPriceDTO["optionData"],
    data: CalculateShippingOptionPriceDTO["data"],
    context: CalculateShippingOptionPriceDTO["context"]
  ): Promise<CalculatedShippingOptionPrice> {
    try {
      const shippingAddress =
        (context as any)?.shipping_address ||
        (context as any)?.cart?.shipping_address

      const metadata = (shippingAddress?.metadata || {}) as Record<string, any>
      const toDistrictId = Number(metadata?.ghn_district_id || metadata?.district_id)
      const toWardCode = metadata?.ghn_ward_code || metadata?.ward_code
      const toProvinceName =
        shippingAddress?.province ||
        shippingAddress?.city ||
        metadata?.ghn_province_name ||
        metadata?.province_name

      // Tính tổng cân nặng từ các items trong giỏ hàng
      const items = ((context as any)?.items || (context as any)?.cart?.items || []) as any[]
      let totalWeight = 0

      for (const item of items) {
        const itemWeight = Number(item?.variant?.weight || item?.weight || 0)
        const qty = Number(item?.quantity || 1)
        totalWeight += (itemWeight > 0 ? itemWeight : (this.options_.defaultWeight || 500)) * qty
      }

      if (totalWeight <= 0) {
        totalWeight = this.options_.defaultWeight || 500
      }

      const fromDistrictId = this.options_.fromDistrictId || 1442
      const fromWardCode = this.options_.fromWardCode

      // Fallback giá tạm tính khi không có địa chỉ người nhận nào
      if (!toDistrictId && !toProvinceName) {
        this.logger_.warn?.(
          "[GHN Fulfillment] No destination address found. Returning fallback fee 30.000₫."
        )
        return {
          calculated_amount: 30000,
          is_calculated_price_tax_inclusive: true,
        }
      }

      // Resolve service_type_id động dựa vào tuyến đưỜng và cân nặng
      let serviceTypeId: number
      const effectiveToDistrict = toDistrictId || 1442 // Fallback Quận 1 nếu dung form mặc định

      serviceTypeId = await this.resolveServiceTypeId(
        fromDistrictId,
        effectiveToDistrict,
        totalWeight
      )

      const feePayload: any = {
        from_district_id: fromDistrictId,
        from_ward_code: fromWardCode,
        service_type_id: serviceTypeId,
        weight: Math.round(totalWeight),
        length: this.options_.defaultDimensions?.length || 10,
        width: this.options_.defaultDimensions?.width || 10,
        height: this.options_.defaultDimensions?.height || 10,
      }

      if (toDistrictId) {
        feePayload.to_district_id = toDistrictId
        if (toWardCode) feePayload.to_ward_code = String(toWardCode)
      } else {
        // Không có district_id (form mặc định), dùng Quận 1 làm fallback
        feePayload.to_district_id = 1442
        feePayload.to_ward_code = "20101"
        feePayload.is_new_to_address = true
        if (toProvinceName) feePayload.to_province_name = toProvinceName
      }

      const feeData = await this.client_.calculateFee(feePayload)

      return {
        calculated_amount: Number(feeData.total || 0),
        is_calculated_price_tax_inclusive: true,
      }
    } catch (error: any) {
      this.logger_.error?.(
        `[GHN Fulfillment] Calculate price failed: ${error?.message}`,
        error
      )
      return {
        calculated_amount: 35000,
        is_calculated_price_tax_inclusive: true,
      }
    }
  }

  /**
   * Tạo vận đơn trên hệ thống GHN khi admin bấm "Create Fulfillment"
   * Hỗ trợ cả 2 định dạng:
   * 1. Định dạng mới (is_new_to_address: true): Dùng to_address, to_province_name, to_ward_name (sau 01/07/2025)
   * 2. Định dạng cũ: Dùng to_district_id (Int) và to_ward_code (String)
   */
  async createFulfillment(
    data: Record<string, unknown>,
    items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    order: Partial<FulfillmentOrderDTO> | undefined,
    fulfillment: Partial<
      Omit<FulfillmentDTO, "provider_id" | "data" | "items">
    >,
    additionalData?: Record<string, unknown>
  ): Promise<CreateFulfillmentResult> {
    const shippingAddress = (order as any)?.shipping_address
    const metadata = (shippingAddress?.metadata || {}) as Record<string, any>

    const toDistrictId = Number(metadata?.ghn_district_id || metadata?.district_id)
    const toWardCode = String(metadata?.ghn_ward_code || metadata?.ward_code || "")
    const toProvinceName =
      shippingAddress?.province ||
      shippingAddress?.city ||
      metadata?.ghn_province_name ||
      metadata?.province_name
    const toWardName =
      metadata?.ghn_ward_name ||
      metadata?.ward_name ||
      shippingAddress?.address_2 ||
      ""

    const useNewFormat = Boolean(
      this.options_.useNewAddressFormat ||
        (!toDistrictId && toProvinceName)
    )

    if (!useNewFormat && (!toDistrictId || !toWardCode)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Cannot create GHN fulfillment: to_district_id and to_ward_code are required when not using is_new_to_address format"
      )
    }

    if (useNewFormat && !toProvinceName) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Cannot create GHN fulfillment: to_province_name is required when using is_new_to_address format"
      )
    }

    const recipientName =
      [shippingAddress?.first_name, shippingAddress?.last_name]
        .filter(Boolean)
        .join(" ") || "Khách Hàng"

    const recipientPhone =
      shippingAddress?.phone || (order as any)?.customer?.phone || "0900000000"

    const recipientAddress = [
      shippingAddress?.address_1,
      shippingAddress?.address_2,
      shippingAddress?.ward,
      shippingAddress?.province,
      shippingAddress?.city,
    ]
      .filter(Boolean)
      .join(", ")

    // Map items sang cấu trúc GHN
    const ghnItems: GhnOrderItem[] = (items || []).map((item: any) => ({
      name: item.title || item.line_item?.title || "Sản phẩm",
      quantity: Number(item.quantity || 1),
      price: Number(item.unit_price || 0),
      weight: Number(item.line_item?.variant?.weight || this.options_.defaultWeight || 500),
      length: this.options_.defaultDimensions?.length || 10,
      width: this.options_.defaultDimensions?.width || 10,
      height: this.options_.defaultDimensions?.height || 10,
    }))

    const totalWeight = ghnItems.reduce(
      (sum, item) => sum + (item.weight || 500) * item.quantity,
      0
    )

    // Resolve service_type_id động tại thời điểm tạo đơn
    let serviceTypeId = 2 // Default fallback
    const effectiveToDistrict = toDistrictId || 1442
    try {
      serviceTypeId = await this.resolveServiceTypeId(
        this.options_.fromDistrictId || 1442,
        effectiveToDistrict,
        totalWeight
      )
    } catch (err: any) {
      this.logger_.warn?.(
        `[GHN Fulfillment] Could not resolve service type, defaulting to 2: ${err?.message}`
      )
    }

    const createOrderPayload: GhnCreateOrderRequest = {
      payment_type_id: this.options_.paymentTypeId || 1,
      required_note: this.options_.requiredNote || "CHOXEMHANGKHONGTHU",
      to_name: recipientName,
      to_phone: recipientPhone,
      to_address: recipientAddress,
      weight: Math.round(totalWeight),
      length: this.options_.defaultDimensions?.length || 10,
      width: this.options_.defaultDimensions?.width || 10,
      height: this.options_.defaultDimensions?.height || 10,
      service_type_id: serviceTypeId,
      client_order_code: (order as any)?.display_id
        ? `ORD-${(order as any)?.display_id}`
        : (order as any)?.id,
      content: `Đơn hàng ${(order as any)?.display_id || (order as any)?.id}`,
      items: ghnItems,
    }

    if (useNewFormat) {
      createOrderPayload.is_new_to_address = true
      if (toProvinceName) createOrderPayload.to_province_name = String(toProvinceName)
      if (toWardName) createOrderPayload.to_ward_name = String(toWardName)
    } else {
      createOrderPayload.to_district_id = toDistrictId
      createOrderPayload.to_ward_code = toWardCode
    }

    const ghnOrder = await this.client_.createOrder(createOrderPayload)
    const orderCode = ghnOrder.order_code

    // Lấy token in phiếu gửi A5
    let labelUrl = ""
    try {
      const printToken = await this.client_.getPrintToken([orderCode])
      labelUrl = this.client_.getPrintUrl(printToken, "printA5")
    } catch (err: any) {
      this.logger_.warn?.(`[GHN Fulfillment] Could not generate print token: ${err?.message}`)
    }

    return {
      data: {
        ...(data as object || {}),
        ghn_order_code: orderCode,
        ghn_total_fee: ghnOrder.total_fee,
        ghn_sort_code: ghnOrder.sort_code,
        ghn_expected_delivery_time: ghnOrder.expected_delivery_time,
        ghn_trans_type: ghnOrder.trans_type,
      },
      labels: [
        {
          tracking_number: orderCode,
          tracking_url: `https://donhang.ghn.vn/?order_code=${orderCode}`,
          label_url: labelUrl,
        },
      ],
    }
  }

  /**
   * Hủy vận đơn trên hệ thống GHN khi admin hủy fulfillment
   */
  async cancelFulfillment(data: Record<string, unknown>): Promise<any> {
    const orderCode = (data as any)?.ghn_order_code || (data as any)?.tracking_number

    if (orderCode) {
      this.logger_.info?.(`[GHN Fulfillment] Cancelling GHN order: ${orderCode}`)
      await this.client_.cancelOrder([String(orderCode)])
    }

    return {
      cancelled_at: new Date().toISOString(),
    }
  }

  /**
   * Tạo return fulfillment (hoàn hàng)
   */
  async createReturnFulfillment(): Promise<CreateFulfillmentResult> {
    return {
      data: {},
      labels: [],
    }
  }
}

export default GiaoHangNhanhProviderService
