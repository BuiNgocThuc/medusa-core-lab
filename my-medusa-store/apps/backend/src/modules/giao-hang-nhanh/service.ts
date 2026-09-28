/**
 * Giao Hàng Nhanh (GHN) Fulfillment Provider Service cho Medusa v2
 */
import {
  AbstractFulfillmentProviderService,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import type {
  CalculatedShippingOptionPrice,
  CalculateShippingOptionPriceDTO,
  CreateFulfillmentResult,
  FulfillmentDTO,
  FulfillmentItemDTO,
  FulfillmentOption,
  FulfillmentOrderDTO,
  ICachingModuleService,
  Logger,
  ValidateFulfillmentDataContext,
} from "@medusajs/framework/types"

import { GhnClient } from "./client"
import { resolveLegacyAddress } from "./address-mapper"
import type {
  GhnAvailableService,
  GhnCreateOrderRequest,
  GhnFeeRequest,
  GhnModuleOptions,
  GhnOrderItem,
} from "./types"

/** TTL cho cache tuyến đường GHN (giây). Mặc định 1 giờ. */
const GHN_ROUTE_CACHE_TTL_SECONDS = 60 * 60

type InjectedDependencies = {
  logger: Logger
  [Modules.CACHING]: ICachingModuleService
}

export class GiaoHangNhanhProviderService extends AbstractFulfillmentProviderService {
  static identifier = "ghn"

  protected readonly logger_: Logger
  protected readonly options_: GhnModuleOptions
  protected readonly client_: GhnClient
  protected readonly cache_: ICachingModuleService

  constructor(container: InjectedDependencies, options: GhnModuleOptions) {
    super()

    this.logger_ = container.logger
    this.cache_ = container[Modules.CACHING]
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
   * Business Rules:
   * 1. Phân loại dịch vụ theo tổng khối lượng:
   *    - Tổng khối lượng < 20.000g (dưới 20kg): chọn service_type_id = 2 (Gói Chuẩn / Hàng nhẹ)
   *    - Tổng khối lượng >= 20.000g (từ 20kg trở lên hoặc nhiều kiện): chọn service_type_id = 5 (Hàng nặng)
   * 2. Luôn giả định hệ thống có sẵn 2 type là 2 và 5:
   *    - Kiểm tra danh sách dịch vụ khả dụng từ GHN (có cache Redis)
   *    - Nếu tìm thấy preferredTypeId → chọn preferredTypeId
   *    - Nếu tuyến đường không có preferredTypeId → thử lấy gói đối ứng còn lại (2 hoặc 5)
   *    - Nếu API không trả về hoặc lỗi → mặc định chọn preferredTypeId (không throw lỗi chặn luồng checkout,
   *      cơ chế fallback retry khi tính phí sẽ đảm bảo luôn có kết quả)
   */
  private async resolveServiceTypeId(
    fromDistrictId: number,
    toDistrictId: number,
    totalWeightGrams: number
  ): Promise<number> {
    const isHeavy = totalWeightGrams >= 20_000
    const preferredTypeId = isHeavy ? 5 : 2

    try {
      const services = await this.getAvailableServicesWithCache_(fromDistrictId, toDistrictId)

      if (services && services.length > 0) {
        // Tìm đúng gói phù hợp dựa theo cân nặng (2 hoặc 5)
        const matched = services.find((s) => s.service_type_id === preferredTypeId)
        if (matched) {
          this.logger_.info?.(
            `[GHN Fulfillment] Resolved service_type_id=${matched.service_type_id} (${matched.short_name}) for weight=${totalWeightGrams}g`
          )
          return matched.service_type_id
        }

        // Nếu tuyến đường không có gói ưu tiên, tìm gói đối ứng (2 hoặc 5)
        const otherTypeId = isHeavy ? 2 : 5
        const alternateMatched = services.find((s) => s.service_type_id === otherTypeId)
        if (alternateMatched) {
          this.logger_.warn?.(
            `[GHN Fulfillment] Preferred service_type_id=${preferredTypeId} not available for route. Using alternate service_type_id=${alternateMatched.service_type_id} (${alternateMatched.short_name})`
          )
          return alternateMatched.service_type_id
        }

        // Fallback: lấy gói đầu tiên khả dụng
        const fallback = services[0]
        this.logger_.warn?.(
          `[GHN Fulfillment] Neither type 2 nor 5 found in available services. Falling back to service_type_id=${fallback.service_type_id} (${fallback.short_name})`
        )
        return fallback.service_type_id
      }
    } catch (err: any) {
      this.logger_.warn?.(
        `[GHN Fulfillment] getAvailableServices failed (${err?.message}), defaulting to preferred service_type_id=${preferredTypeId}`
      )
    }

    // Mặc định luôn giả định hệ thống có sẵn 2 type là 2 và 5
    return preferredTypeId
  }

  /**
   * Lấy danh sách dịch vụ khả dụng của GHN theo tuyến đường, có cache Redis.
   *
   * Cache key: `ghn:available-services:{shopId}:{fromDistrictId}:{toDistrictId}`
   * Cache TTL: 1 giờ (GHN_ROUTE_CACHE_TTL_SECONDS)
   *
   * Flow:
   *   cache hit  → trả về ngay (0 network call)
   *   cache miss → gọi GHN API → ghi cache → trả về
   *   cache lỗi  → log warn, bỏ qua cache, gọi thẳng API (graceful degradation)
   */
  private async getAvailableServicesWithCache_(
    fromDistrictId: number,
    toDistrictId: number
  ): Promise<GhnAvailableService[]> {
    const shopId = this.options_.shopId
    const cacheKey = `ghn:available-services:${shopId}:${fromDistrictId}:${toDistrictId}`

    // Cache read
    try {
      const cached = await this.cache_.get({ key: cacheKey })
      if (cached) {
        this.logger_.debug?.(
          `[GHN Cache] HIT — available-services for route ${fromDistrictId}→${toDistrictId}`
        )
        return cached as GhnAvailableService[]
      }
    } catch (cacheErr: any) {
      this.logger_.warn?.(
        `[GHN Cache] Read failed, bypassing cache: ${cacheErr?.message}`
      )
    }

    // Cache miss → fetch from GHN
    this.logger_.debug?.(
      `[GHN Cache] MISS — fetching available-services for route ${fromDistrictId}→${toDistrictId}`
    )
    const services = await this.client_.getAvailableServices(fromDistrictId, toDistrictId)

    // Cache write (non-blocking, fire-and-forget)
    if (services && services.length > 0) {
      this.cache_
        .set({
          key: cacheKey,
          data: services as unknown as object,
          ttl: GHN_ROUTE_CACHE_TTL_SECONDS,
        })
        .catch((err: any) => {
          this.logger_.warn?.(`[GHN Cache] Write failed (non-critical): ${err?.message}`)
        })
    }

    return services
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

      const metadata = (
        shippingAddress?.metadata ||
        (context as any)?.cart?.metadata ||
        (context as any)?.metadata ||
        {}
      ) as Record<string, any>

      // Ánh xạ địa chỉ người nhận (hỗ trợ cả mô hình 2 cấp GHN v3 và 3 cấp truyền thống)
      const mappedAddress = resolveLegacyAddress({
        provinceId: metadata?.ghn_province_id,
        provinceName: metadata?.ghn_province_name || shippingAddress?.province,
        province: shippingAddress?.province,
        districtId: metadata?.ghn_district_id || metadata?.district_id,
        districtName: metadata?.ghn_district_name,
        wardId: metadata?.ghn_ward_id,
        wardName: metadata?.ghn_ward_name || shippingAddress?.city,
        wardCode: metadata?.ghn_ward_code || metadata?.ward_code,
        city: shippingAddress?.city,
        address1: shippingAddress?.address_1,
      })

      const toDistrictId = Number(mappedAddress?.districtId || metadata?.ghn_district_id || metadata?.district_id)
      const toWardCode = mappedAddress?.wardCode || metadata?.ghn_ward_code || metadata?.ward_code
      const toProvinceName =
        shippingAddress?.province ||
        metadata?.ghn_province_name ||
        mappedAddress?.provinceName ||
        metadata?.province_name ||
        shippingAddress?.city
      const toWardName =
        metadata?.ghn_ward_name ||
        mappedAddress?.wardName ||
        metadata?.ward_name ||
        shippingAddress?.city

      // Tính tổng cân nặng từ các items trong giỏ hàng
      const items = ((context as any)?.items || (context as any)?.cart?.items || []) as any[]
      let totalWeight = 0

      for (const item of items) {
        // Thứ tự ưu tiên cân nặng chuẩn Medusa v2:
        // 1. Variant weight (Authoritative): Biến thể/SKU thực tế
        // 2. Product weight (Fallback): Thông tin tham khảo/mẫu từ sản phẩm cha
        // 3. defaultWeight (System fallback): Mặc định 500g
        const variantWeight = Number(item?.variant?.weight || 0)
        const productWeight = Number(item?.product?.weight || item?.variant?.product?.weight || 0)
        const fallbackWeight = this.options_.defaultWeight || 500

        const itemWeight = variantWeight > 0 ? variantWeight : (productWeight > 0 ? productWeight : fallbackWeight)
        const qty = Number(item?.quantity || 1)
        totalWeight += itemWeight * qty
      }

      if (totalWeight <= 0) {
        totalWeight = this.options_.defaultWeight || 500
      }

      this.logger_.info?.(
        `[GHN Fulfillment] Calculated total cart weight: ${totalWeight}g from ${items.length} items`
      )

      // Map items sang cấu trúc GHN DTO (chuẩn bị cho cả tính phí service_type_id 5 và tạo đơn)
      const ghnItems: GhnOrderItem[] = items.map((item: any) => {
        const variantWeight = Number(item?.variant?.weight || 0)
        const productWeight = Number(item?.product?.weight || item?.variant?.product?.weight || 0)
        const fallbackWeight = this.options_.defaultWeight || 500
        const itemWeight = variantWeight > 0 ? variantWeight : (productWeight > 0 ? productWeight : fallbackWeight)

        const variantLength = Number(item?.variant?.length || 0)
        const productLength = Number(item?.product?.length || item?.variant?.product?.length || 0)
        const fallbackLength = this.options_.defaultDimensions?.length || 10
        const itemLength = variantLength > 0 ? variantLength : (productLength > 0 ? productLength : fallbackLength)

        const variantWidth = Number(item?.variant?.width || 0)
        const productWidth = Number(item?.product?.width || item?.variant?.product?.width || 0)
        const fallbackWidth = this.options_.defaultDimensions?.width || 10
        const itemWidth = variantWidth > 0 ? variantWidth : (productWidth > 0 ? productWidth : fallbackWidth)

        const variantHeight = Number(item?.variant?.height || 0)
        const productHeight = Number(item?.product?.height || item?.variant?.product?.height || 0)
        const fallbackHeight = this.options_.defaultDimensions?.height || 10
        const itemHeight = variantHeight > 0 ? variantHeight : (productHeight > 0 ? productHeight : fallbackHeight)

        return {
          name: item?.title || item?.variant?.title || "Sản phẩm",
          code: item?.variant?.sku || undefined,
          quantity: Math.max(1, Number(item?.quantity || 1)),
          price: Math.max(0, Number(item?.unit_price || 0)),
          weight: Math.round(itemWeight),
          length: Math.round(itemLength),
          width: Math.round(itemWidth),
          height: Math.round(itemHeight),
        }
      })

      if (ghnItems.length === 0) {
        ghnItems.push({
          name: "Kiện hàng",
          quantity: 1,
          weight: Math.round(totalWeight),
          length: this.options_.defaultDimensions?.length || 10,
          width: this.options_.defaultDimensions?.width || 10,
          height: this.options_.defaultDimensions?.height || 10,
        })
      }

      // Lấy thông tin kho gửi hàng (Ship From):
      // 1. Ưu tiên lấy từ Stock Location trong context (địa chỉ kho thực tế)
      // 2. Fallback về cấu hình options trong medusa-config.ts
      const fromLocation = (context as any)?.from_location
      const fromMeta = (
        fromLocation?.address?.metadata ||
        fromLocation?.metadata ||
        {}
      ) as Record<string, any>
      const fromGhn = (fromMeta?.ghn || {}) as Record<string, any>

      const fromDistrictId = Number(
        fromGhn?.district_id ||
        fromMeta?.ghn_district_id ||
        fromMeta?.district_id ||
        this.options_.fromDistrictId ||
        1442
      )
      const fromWardCode = String(
        fromGhn?.ward_code ||
        fromMeta?.ghn_ward_code ||
        fromMeta?.ward_code ||
        this.options_.fromWardCode ||
        "20101"
      )

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

      // Resolve service_type_id động dựa vào tuyến đường và cân nặng
      let serviceTypeId: number
      const effectiveToDistrict = toDistrictId || 1442 // Fallback Quận 1 nếu dùng form mặc định

      serviceTypeId = await this.resolveServiceTypeId(
        fromDistrictId,
        effectiveToDistrict,
        totalWeight
      )

      const feePayload: GhnFeeRequest = {
        from_district_id: fromDistrictId,
        from_ward_code: fromWardCode,
        service_type_id: serviceTypeId,
        weight: Math.round(totalWeight),
      }

      if (toDistrictId) {
        feePayload.to_district_id = toDistrictId
        if (toWardCode) feePayload.to_ward_code = String(toWardCode)
      } else {
        // Không có district_id (form mặc định), dùng Quận 1 làm fallback để tính cước
        feePayload.to_district_id = 1442
        feePayload.to_ward_code = "20101"
      }

      // BUSINESS RULE TÍNH PHÍ GHN:
      // - Với service_type_id = 5 (tổng khối lượng ≥ 20 kg hoặc nhiều kiện):
      //   GHN tính phí theo từng kiện từ items[], nên mỗi item bắt buộc có length, width, height, weight.
      // - Với service_type_id = 2 (dưới 20 kg):
      //   Chỉ cần kích thước ở cấp đơn hàng (root: weight, length, width, height).
      if (serviceTypeId === 5) {
        feePayload.items = ghnItems
      } else {
        feePayload.length = this.options_.defaultDimensions?.length || 10
        feePayload.width = this.options_.defaultDimensions?.width || 10
        feePayload.height = this.options_.defaultDimensions?.height || 10
      }

      this.logger_.info?.(
        `[GHN Fulfillment] Requesting fee calculation: route ${fromDistrictId} → ${feePayload.to_district_id} | service_type_id=${feePayload.service_type_id} | weight=${feePayload.weight}g | items=${feePayload.items?.length || 0}`
      )

      let feeData: any
      try {
        feeData = await this.client_.calculateFee(feePayload)
      } catch (err: any) {
        // Cơ chế Fallback 2 chiều giữa service_type_id 5 và 2:
        // 1. Nếu gói 5 fail (ví dụ shop chưa kích hoạt bảng giá hàng nặng), tự động retry với gói chuẩn 2
        // 2. Nếu gói 2 fail nhưng có items, thử fallback sang gói 5
        if (feePayload.service_type_id === 5) {
          this.logger_.warn?.(
            `[GHN Fulfillment] Calculate fee failed with service_type_id=5 (${err?.message}), falling back to service_type_id=2`
          )
          const fallbackPayload: GhnFeeRequest = {
            ...feePayload,
            service_type_id: 2,
            length: this.options_.defaultDimensions?.length || 10,
            width: this.options_.defaultDimensions?.width || 10,
            height: this.options_.defaultDimensions?.height || 10,
          }
          delete fallbackPayload.items
          feeData = await this.client_.calculateFee(fallbackPayload)
        } else if (feePayload.service_type_id === 2 && ghnItems.length > 0) {
          this.logger_.warn?.(
            `[GHN Fulfillment] Calculate fee failed with service_type_id=2 (${err?.message}), retrying with service_type_id=5`
          )
          const fallbackPayload: GhnFeeRequest = {
            ...feePayload,
            service_type_id: 5,
            items: ghnItems,
          }
          feeData = await this.client_.calculateFee(fallbackPayload)
        } else {
          throw err
        }
      }

      this.logger_.info?.(
        `[GHN Fulfillment] Fee calculation result: total=${feeData.total}₫ (service_fee=${feeData.service_fee}₫, cod_fee=${feeData.cod_fee || 0}₫, insurance_fee=${feeData.insurance_fee || 0}₫)`
      )

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
    const metadata = (
      shippingAddress?.metadata ||
      (order as any)?.metadata ||
      {}
    ) as Record<string, any>

    const mappedOrderAddress = resolveLegacyAddress({
      provinceId: metadata?.ghn_province_id,
      provinceName: metadata?.ghn_province_name || shippingAddress?.province,
      province: shippingAddress?.province,
      districtId: metadata?.ghn_district_id || metadata?.district_id,
      districtName: metadata?.ghn_district_name,
      wardId: metadata?.ghn_ward_id,
      wardName: metadata?.ghn_ward_name || shippingAddress?.city,
      wardCode: metadata?.ghn_ward_code || metadata?.ward_code,
      city: shippingAddress?.city,
      address1: shippingAddress?.address_1,
    })

    const toDistrictId = Number(mappedOrderAddress?.districtId || metadata?.ghn_district_id || metadata?.district_id)
    const toWardCode = String(mappedOrderAddress?.wardCode || metadata?.ghn_ward_code || metadata?.ward_code || "")
    const toProvinceName =
      shippingAddress?.province ||
      metadata?.ghn_province_name ||
      mappedOrderAddress?.provinceName ||
      metadata?.province_name ||
      shippingAddress?.city
    const toWardName =
      metadata?.ghn_ward_name ||
      mappedOrderAddress?.wardName ||
      shippingAddress?.city ||
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

    // Map items sang cấu trúc GHN (ưu tiên variant > product > fallback)
    const ghnItems: GhnOrderItem[] = (items || []).map((item: any) => {
      const variantWeight = Number(item.line_item?.variant?.weight || 0)
      const productWeight = Number(item.line_item?.product?.weight || item.line_item?.variant?.product?.weight || 0)
      const fallbackWeight = this.options_.defaultWeight || 500
      const itemWeight = variantWeight > 0 ? variantWeight : (productWeight > 0 ? productWeight : fallbackWeight)

      const variantLength = Number(item.line_item?.variant?.length || 0)
      const productLength = Number(item.line_item?.product?.length || item.line_item?.variant?.product?.length || 0)
      const fallbackLength = this.options_.defaultDimensions?.length || 10
      const itemLength = variantLength > 0 ? variantLength : (productLength > 0 ? productLength : fallbackLength)

      const variantWidth = Number(item.line_item?.variant?.width || 0)
      const productWidth = Number(item.line_item?.product?.width || item.line_item?.variant?.product?.width || 0)
      const fallbackWidth = this.options_.defaultDimensions?.width || 10
      const itemWidth = variantWidth > 0 ? variantWidth : (productWidth > 0 ? productWidth : fallbackWidth)

      const variantHeight = Number(item.line_item?.variant?.height || 0)
      const productHeight = Number(item.line_item?.product?.height || item.line_item?.variant?.product?.height || 0)
      const fallbackHeight = this.options_.defaultDimensions?.height || 10
      const itemHeight = variantHeight > 0 ? variantHeight : (productHeight > 0 ? productHeight : fallbackHeight)

      return {
        name: item.title || item.line_item?.title || "Sản phẩm",
        code: item.line_item?.variant?.sku || undefined,
        quantity: Math.max(1, Number(item.quantity || 1)),
        price: Math.max(0, Number(item.unit_price || 0)),
        weight: Math.round(itemWeight),
        length: Math.round(itemLength),
        width: Math.round(itemWidth),
        height: Math.round(itemHeight),
      }
    })

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

    this.logger_.info?.(
      `[GHN Fulfillment] Submitting createOrder to GHN: recipient="${recipientName}" | phone="${recipientPhone}" | service_type_id=${createOrderPayload.service_type_id} | totalWeight=${createOrderPayload.weight}g | items=${createOrderPayload.items.length}`
    )

    let ghnOrder: any
    try {
      ghnOrder = await this.client_.createOrder(createOrderPayload)
    } catch (createErr: any) {
      // Nếu tạo đơn bằng service_type_id 5 bị lỗi, tự động thử lại với gói chuẩn 2
      if (createOrderPayload.service_type_id === 5) {
        this.logger_.warn?.(
          `[GHN Fulfillment] createOrder failed with service_type_id=5 (${createErr?.message}), retrying with service_type_id=2`
        )
        createOrderPayload.service_type_id = 2
        ghnOrder = await this.client_.createOrder(createOrderPayload)
      } else {
        throw createErr
      }
    }
    const orderCode = ghnOrder.order_code

    this.logger_.info?.(
      `[GHN Fulfillment] Order created successfully: order_code=${orderCode} | total_fee=${ghnOrder.total_fee}₫ | sort_code=${ghnOrder.sort_code}`
    )

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
