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
   * Trả về danh sách các dịch vụ giao hàng mà GHN hỗ trợ
   */
  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [
      {
        id: "ghn-standard",
        name: "Giao Hàng Nhanh - Chuẩn",
        service_type_id: 2,
      },
      {
        id: "ghn-fast",
        name: "Giao Hàng Nhanh - Tiết Kiệm / Nhanh",
        service_type_id: 1,
      },
      {
        id: "ghn-express",
        name: "Giao Hàng Nhanh - Hỏa Tốc",
        service_type_id: 3,
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
   * Xác thực và làm giàu dữ liệu shipping method khi khách hàng chọn method
   */
  async validateFulfillmentData(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    context: ValidateFulfillmentDataContext
  ): Promise<any> {
    return {
      ...data,
      service_type_id: optionData?.service_type_id || 2,
    }
  }

  /**
   * Báo cho Medusa biết Provider này có thể tính giá động (Calculated Price)
   */
  async canCalculate(data: any): Promise<boolean> {
    return true
  }

  /**
   * Tính phí vận chuyển theo thời gian thực từ GHN API
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
      const toWardName =
        metadata?.ghn_ward_name ||
        metadata?.ward_name ||
        shippingAddress?.address_2

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

      const serviceTypeId = Number(
        (data as any)?.service_type_id ||
          (optionData as any)?.service_type_id ||
          2
      )

      const fromDistrictId = this.options_.fromDistrictId || 1442
      const fromWardCode = this.options_.fromWardCode

      // Nếu không có district_id và cũng không có province_name -> dùng phí tạm tính
      if (!toDistrictId && !toProvinceName) {
        this.logger_.warn?.(
          "[GHN Fulfillment] Neither toDistrictId nor toProvinceName found. Returning fallback fee."
        )
        return {
          calculated_amount: 30000,
          is_calculated_price_tax_inclusive: true,
        }
      }

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
        feePayload.is_new_to_address = true
        feePayload.to_province_name = toProvinceName
        if (toWardName) feePayload.to_ward_name = toWardName
      }

      const feeData = await this.client_.calculateFee(feePayload)

      return {
        calculated_amount: Number(feeData.total || 0),
        is_calculated_price_tax_inclusive: true,
      }
    } catch (error: any) {
      this.logger_.error?.(`[GHN Fulfillment] Calculate price failed: ${error?.message}`, error)
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

    const serviceTypeId = Number(
      (data as any)?.service_type_id || 2
    )

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
