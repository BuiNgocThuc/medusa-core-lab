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

    const toProvinceName = String(
      metadata?.ghn_province_name ||
      shippingAddress?.province ||
      mappedOrderAddress?.provinceName ||
      metadata?.province_name ||
      shippingAddress?.city ||
      ""
    ).trim()

    const toDistrictName = String(
      metadata?.ghn_district_name ||
      mappedOrderAddress?.districtName ||
      metadata?.district_name ||
      ""
    ).trim()

    const toWardName = String(
      metadata?.ghn_ward_name ||
      mappedOrderAddress?.wardName ||
      metadata?.ward_name ||
      shippingAddress?.address_2 ||
      ""
    ).trim()

    // Xác định định dạng địa chỉ người nhận:
    // - false (mặc định): Hệ cũ 3 cấp (phường/xã + quận/huyện + tỉnh) -> to_district_name là bắt buộc
    // - true: Hệ mới 2 cấp (phường/xã + tỉnh) sau 01/07/2025 -> để trống to_district_name
    const useNewAddress = Boolean(
      this.options_.useNewAddressFormat ||
      metadata?.is_new_to_address === true ||
      (!toDistrictName && toProvinceName && toWardName)
    )

    if (!toProvinceName) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Cannot create GHN fulfillment: to_province_name is required by GHN API"
      )
    }

    if (!toWardName) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Cannot create GHN fulfillment: to_ward_name is required by GHN API"
      )
    }

    if (!useNewAddress && !toDistrictName) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Cannot create GHN fulfillment: to_district_name is required when is_new_to_address is false"
      )
    }

    const recipientName =
      [shippingAddress?.first_name, shippingAddress?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim()
        .slice(0, 1024) || "Khách Hàng"

    // SĐT người nhận: giữ nguyên giá trị không tự ý format / chuẩn hóa
    const recipientPhone = String(
      shippingAddress?.phone || (order as any)?.customer?.phone || ""
    ).trim()

    if (!recipientPhone) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Cannot create GHN fulfillment: to_phone is required"
      )
    }

    const recipientAddress = (
      shippingAddress?.address_1 ||
      [shippingAddress?.address_1, shippingAddress?.address_2].filter(Boolean).join(", ") ||
      toWardName ||
      "Địa chỉ nhận hàng"
    )
      .trim()
      .slice(0, 1024)

    // Map items sang cấu trúc GHN (lấy dữ liệu thực từ order.items dựa theo line_item_id)
    const orderItems: any[] = (order as any)?.items || []

    const ghnItems: GhnOrderItem[] = (items || []).map((item: any) => {
      // 1. Tìm đúng line item trong order
      const lineItem = orderItems.find(
        (oi: any) => oi.id === item.line_item_id || oi.id === item.id
      )
      const variant = lineItem?.variant
      const product = variant?.product || lineItem?.product

      // 2. Tên sản phẩm chuẩn (tối đa 512 ký tự)
      const prodTitle =
        lineItem?.product_title || lineItem?.title || product?.title || "Sản phẩm"
      const varTitle =
        lineItem?.variant_title || variant?.title || item.title
      const finalName =
        varTitle && varTitle !== "Default" && varTitle !== prodTitle
          ? `${prodTitle} (${varTitle})`
          : prodTitle

      // 3. Mã SKU (tối đa 50 ký tự)
      const finalSku =
        item.sku ||
        variant?.sku ||
        lineItem?.variant_sku ||
        item.barcode ||
        undefined

      // 4. Đơn giá thực tế (VND)
      const finalPrice = Math.max(
        0,
        Number(lineItem?.unit_price ?? item.unit_price ?? 0)
      )

      // 5. Khối lượng (g): ưu tiên variant > lineItem > product > default
      const variantWeight = Number(
        variant?.weight || lineItem?.variant?.weight || 0
      )
      const productWeight = Number(product?.weight || 0)
      const fallbackWeight = this.options_.defaultWeight || 500
      const itemWeight =
        variantWeight > 0
          ? variantWeight
          : productWeight > 0
          ? productWeight
          : fallbackWeight

      // 6. Kích thước (cm)
      const fallbackLength = this.options_.defaultDimensions?.length || 10
      const fallbackWidth = this.options_.defaultDimensions?.width || 10
      const fallbackHeight = this.options_.defaultDimensions?.height || 10

      const itemLength = Number(
        variant?.length || product?.length || fallbackLength
      )
      const itemWidth = Number(
        variant?.width || product?.width || fallbackWidth
      )
      const itemHeight = Number(
        variant?.height || product?.height || fallbackHeight
      )

      return {
        name: finalName.slice(0, 512),
        code: finalSku ? String(finalSku).slice(0, 50) : undefined,
        quantity: Math.max(1, Math.round(Number(item.quantity || lineItem?.quantity || 1))),
        price: Math.round(finalPrice),
        length: Math.max(1, Math.min(200, Math.round(itemLength))),
        width: Math.max(1, Math.min(200, Math.round(itemWidth))),
        height: Math.max(1, Math.min(200, Math.round(itemHeight))),
        weight: Math.max(1, Math.min(50000, Math.round(itemWeight))),
      }
    })

    const totalWeight = Math.min(
      50_000,
      Math.max(
        1,
        ghnItems.reduce(
          (sum, item) => sum + (item.weight || 500) * item.quantity,
          0
        )
      )
    )

    const orderLength = Math.max(
      1,
      Math.min(200, Math.round(this.options_.defaultDimensions?.length || 10))
    )
    const orderWidth = Math.max(
      1,
      Math.min(200, Math.round(this.options_.defaultDimensions?.width || 10))
    )
    const orderHeight = Math.max(
      1,
      Math.min(200, Math.round(this.options_.defaultDimensions?.height || 10))
    )

    // Resolve service_type_id động tại thời điểm tạo đơn: 2 (<20kg) hoặc 5 (>=20kg)
    let serviceTypeId: 2 | 5 = totalWeight >= 20_000 ? 5 : 2
    const toDistrictId = Number(
      mappedOrderAddress?.districtId || metadata?.ghn_district_id || metadata?.district_id || 1442
    )
    try {
      const resolved = await this.resolveServiceTypeId(
        this.options_.fromDistrictId || 1442,
        toDistrictId,
        totalWeight
      )
      if (resolved === 2 || resolved === 5) {
        serviceTypeId = resolved
      }
    } catch (err: any) {
      this.logger_.warn?.(
        `[GHN Fulfillment] Could not resolve service type, defaulting to ${serviceTypeId}: ${err?.message}`
      )
    }

    // Giá trị đơn hàng & COD
    const orderTotal = Math.round(Number((order as any)?.total ?? 0))
    const isPaid = (order as any)?.payment_status === "captured"
    const isCodPayment =
      metadata?.payment_method === "cod" ||
      additionalData?.is_cod === true ||
      (!isPaid && metadata?.cod_amount !== undefined)

    let codAmount = 0
    if (additionalData?.cod_amount !== undefined) {
      codAmount = Math.max(0, Math.round(Number(additionalData.cod_amount)))
    } else if (metadata?.cod_amount !== undefined) {
      codAmount = Math.max(0, Math.round(Number(metadata.cod_amount)))
    } else if (isCodPayment && !isPaid && orderTotal > 0) {
      codAmount = Math.min(50_000_000, orderTotal)
    }

    const insuranceValue = Math.min(
      5_000_000,
      Math.max(0, orderTotal)
    )
    const orderValue = Math.max(0, orderTotal)

    const clientOrderCode = (
      (order as any)?.display_id
        ? `ORD-${(order as any)?.display_id}`
        : (order as any)?.id || ""
    ).slice(0, 50)

    const contentDescription = (
      `Đơn hàng #${(order as any)?.display_id || (order as any)?.id || ""}`
    ).slice(0, 2000)

    const driverNote = (
      metadata?.note ||
      (order as any)?.customer_note ||
      additionalData?.note ||
      ""
    ).slice(0, 5000)

    // Xây dựng payload đúng chuẩn theo tài liệu GHN: https://developer.ghn.dev/vi/docs/order/create#tham-so
    const createOrderPayload: GhnCreateOrderRequest = {
      // 1. Khối người nhận (to)
      to_name: recipientName,
      to_phone: recipientPhone,
      to_address: recipientAddress,
      to_ward_name: toWardName,
      to_province_name: toProvinceName,
      ...(useNewAddress
        ? { is_new_to_address: true }
        : { to_district_name: toDistrictName, is_new_to_address: false }
      ),

      // 2. Khối kiện hàng (Bắt buộc)
      weight: Math.round(totalWeight),
      length: orderLength,
      width: orderWidth,
      height: orderHeight,

      // 3. Khối dịch vụ & thanh toán (Bắt buộc)
      service_type_id: serviceTypeId,
      payment_type_id: this.options_.paymentTypeId || 1,
      required_note: this.options_.requiredNote || "CHOXEMHANGKHONGTHU",

      // 4. Khối thông tin đơn hàng & thu hộ
      client_order_code: clientOrderCode || undefined,
      content: contentDescription,
      note: driverNote || undefined,
      cod_amount: codAmount,
      cod_failed_amount: 0,
      insurance_value: insuranceValue,
      order_value: orderValue,

      // 5. Danh sách sản phẩm
      items: ghnItems,
    }

    // Khối thông tin người gửi (from) - nếu shop có cấu hình
    if (this.options_.fromName) createOrderPayload.from_name = this.options_.fromName.slice(0, 1024)
    if (this.options_.fromPhone) createOrderPayload.from_phone = this.options_.fromPhone
    if (this.options_.fromHotline) createOrderPayload.from_hotline = this.options_.fromHotline
    if (this.options_.fromAddress) createOrderPayload.from_address = this.options_.fromAddress.slice(0, 1024)
    if (this.options_.fromWardName) createOrderPayload.from_ward_name = this.options_.fromWardName
    if (this.options_.fromDistrictName) createOrderPayload.from_district_name = this.options_.fromDistrictName
    if (this.options_.fromProvinceName) createOrderPayload.from_province_name = this.options_.fromProvinceName
    if (this.options_.isNewFromAddress !== undefined) createOrderPayload.is_new_from_address = this.options_.isNewFromAddress

    // Khối thông tin trả hàng (return) - nếu shop có cấu hình
    if (this.options_.returnName) createOrderPayload.return_name = this.options_.returnName.slice(0, 1024)
    if (this.options_.returnPhone) createOrderPayload.return_phone = this.options_.returnPhone
    if (this.options_.returnAddress) createOrderPayload.return_address = this.options_.returnAddress.slice(0, 1024)
    if (this.options_.returnWardName) createOrderPayload.return_ward_name = this.options_.returnWardName
    if (this.options_.returnDistrictName) createOrderPayload.return_district_name = this.options_.returnDistrictName
    if (this.options_.returnProvinceName) createOrderPayload.return_province_name = this.options_.returnProvinceName
    if (this.options_.isNewReturnAddress !== undefined) createOrderPayload.is_new_return_address = this.options_.isNewReturnAddress

    this.logger_.info?.(
      `[GHN Fulfillment] Submitting createOrder to GHN: recipient="${recipientName}" | phone="${recipientPhone}" | province="${toProvinceName}" | district="${toDistrictName || '(none)'}" | ward="${toWardName}" | is_new_to_address=${createOrderPayload.is_new_to_address} | service_type_id=${createOrderPayload.service_type_id} | totalWeight=${createOrderPayload.weight}g | items=${createOrderPayload.items?.length || 0}`
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
