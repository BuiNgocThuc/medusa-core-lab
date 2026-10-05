/**
 * Giao Hàng Nhanh (GHN) Fulfillment Provider Service cho Medusa v2
 */
import {
  AbstractFulfillmentProviderService,
  ContainerRegistrationKeys,
  createPgConnection,
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
import { detectRegion, resolveLegacyAddress } from "./address-mapper"
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
  [ContainerRegistrationKeys.PG_CONNECTION]?: any
}

export class GiaoHangNhanhProviderService extends AbstractFulfillmentProviderService {
  static identifier = "ghn"

  protected readonly logger_: Logger
  protected readonly options_: GhnModuleOptions
  protected readonly client_: GhnClient
  protected readonly cache_: ICachingModuleService
  protected stockLocationCache_: Map<string, any> = new Map()
  protected pgConnection_: any = null

  /**
   * Lấy kết nối PostgreSQL:
   * 1. Ưu tiên tuyệt đối Knex connection pool được Medusa inject sẵn qua Container (`ContainerRegistrationKeys.PG_CONNECTION`).
   * 2. Chỉ fallback tạo connection mới từ process.env.DATABASE_URL nếu chạy trong môi trường standalone/test không có container.
   * 3. Tuyệt đối không hardcode credentials/host/port local.
   */
  protected getPgConnection() {
    if (!this.pgConnection_) {
      if (process.env.DATABASE_URL) {
        this.pgConnection_ = createPgConnection({
          clientUrl: process.env.DATABASE_URL,
        })
      } else {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "[GHN Fulfillment] Database connection is not available in container and DATABASE_URL is not set."
        )
      }
    }
    return this.pgConnection_
  }

  /**
   * Truy vấn thông tin chi tiết của Stock Location (Kho gửi hàng) từ DB
   * Hỗ trợ đa kho: Tự động lấy kho theo locationId hoặc kho mặc định
   */
  async resolveStockLocation(locationId?: string): Promise<{
    id: string
    name: string
    company?: string
    address_1?: string
    city?: string
    province?: string
    phone?: string
    districtId: number
    wardCode: string
    wardName: string
    districtName: string
    provinceName: string
    provinceId?: number
    isNewAddress: boolean
    region?: "NORTH" | "SOUTH" | "CENTRAL"
  } | null> {
    const cacheKey = locationId || "default_stock_location"
    if (this.stockLocationCache_.has(cacheKey)) {
      return this.stockLocationCache_.get(cacheKey)
    }

    try {
      const knex = this.getPgConnection()
      let query = knex("stock_location as sl")
        .leftJoin("stock_location_address as sla", "sl.address_id", "sla.id")
        .select(
          "sl.id",
          "sl.name",
          "sl.metadata as sl_metadata",
          "sla.address_1",
          "sla.address_2",
          "sla.city",
          "sla.province",
          "sla.phone",
          "sla.metadata as sla_metadata"
        )

      if (locationId) {
        query = query.where("sl.id", locationId)
      }

      const rows = await query.limit(1)
      if (!rows || rows.length === 0) {
        return null
      }

      const row = rows[0]
      const meta = (row.sla_metadata || row.sl_metadata || {}) as Record<string, any>
      const ghn = (meta.ghn || {}) as Record<string, any>
      const provinceId = Number(ghn.province_id || meta.province_id || meta.v3_province_id || 0)
      const provinceName = String(ghn.province_name || meta.province_name || row.province || "Hồ Chí Minh")

      const result = {
        id: row.id,
        name: row.name,
        company: meta.company,
        address_1: row.address_1,
        city: row.city,
        province: row.province,
        phone: row.phone || "0901234567",
        districtId: Number(ghn.district_id || meta.district_id || meta.ghn_district_id || 3695),
        wardCode: String(ghn.ward_code || meta.ward_code || meta.ghn_ward_code || "90741"),
        wardName: String(ghn.ward_name || meta.ward_name || "Phường Hiệp Bình"),
        districtName: String(ghn.district_name || meta.district_name || "Thành Phố Thủ Đức"),
        provinceName,
        provinceId: provinceId > 0 ? provinceId : undefined,
        isNewAddress: Boolean(ghn.is_new_address ?? meta.is_new_address ?? true),
        region: detectRegion({ provinceId, provinceName: provinceName || row.name }),
      }

      this.stockLocationCache_.set(cacheKey, result)
      if (row.id) {
        this.stockLocationCache_.set(row.id, result)
      }

      return result
    } catch (err: any) {
      this.logger_.warn?.(`[GHN Fulfillment] Failed to resolve stock location: ${err?.message}`)
      return null
    }
  }

  /**
   * Lấy danh sách tất cả các Stock Location đang hoạt động từ DB (có cache)
   */
  async resolveAllStockLocations(): Promise<Array<{
    id: string
    name: string
    company?: string
    address_1?: string
    city?: string
    province?: string
    phone?: string
    districtId: number
    wardCode: string
    wardName: string
    districtName: string
    provinceName: string
    provinceId?: number
    isNewAddress: boolean
    region?: "NORTH" | "SOUTH" | "CENTRAL"
  }>> {
    try {
      const knex = this.getPgConnection()
      // Chỉ lấy các Stock Location có liên kết với Fulfillment Set đang hoạt động (loại bỏ các kho đã disable/chưa cấu hình)
      const rows = await knex("stock_location as sl")
        .innerJoin("location_fulfillment_set as lfs", "sl.id", "lfs.stock_location_id")
        .leftJoin("stock_location_address as sla", "sl.address_id", "sla.id")
        .whereNull("sl.deleted_at")
        .distinctOn("sl.id")
        .select(
          "sl.id",
          "sl.name",
          "sl.metadata as sl_metadata",
          "sla.address_1",
          "sla.address_2",
          "sla.city",
          "sla.province",
          "sla.phone",
          "sla.metadata as sla_metadata"
        )
        .orderBy("sl.id", "asc")

      return rows.map((row: any) => {
        const meta = (row.sla_metadata || row.sl_metadata || {}) as Record<string, any>
        const ghn = (meta.ghn || {}) as Record<string, any>
        const provinceId = Number(ghn.province_id || meta.province_id || meta.v3_province_id || 0)
        const provinceName = String(ghn.province_name || meta.province_name || row.province || "")
        return {
          id: row.id,
          name: row.name,
          company: meta.company,
          address_1: row.address_1,
          city: row.city,
          province: row.province,
          phone: row.phone || "0901234567",
          districtId: Number(ghn.district_id || meta.district_id || meta.ghn_district_id || 3695),
          wardCode: String(ghn.ward_code || meta.ward_code || meta.ghn_ward_code || "90741"),
          wardName: String(ghn.ward_name || meta.ward_name || "Phường Hiệp Bình"),
          districtName: String(ghn.district_name || meta.district_name || "Thành Phố Thủ Đức"),
          provinceName,
          provinceId: provinceId > 0 ? provinceId : undefined,
          isNewAddress: Boolean(ghn.is_new_address ?? meta.is_new_address ?? true),
          region: detectRegion({ provinceId, provinceName: provinceName || row.name }),
        }
      })
    } catch (err: any) {
      this.logger_.warn?.(`[GHN Fulfillment] Failed to resolve all stock locations: ${err?.message}`)
      return []
    }
  }

  /**
   * Lọc danh sách kho theo khả năng đáp ứng tồn kho (Inventory Level)
   */
  async filterWarehousesByInventory(
    warehouses: any[],
    items: any[]
  ): Promise<any[]> {
    if (!warehouses || warehouses.length <= 1 || !items || items.length === 0) {
      return warehouses
    }

    const variantIds = items
      .map((i) => i.variant_id || i.variant?.id)
      .filter(Boolean)

    if (variantIds.length === 0) {
      return warehouses
    }

    try {
      const knex = this.getPgConnection()
      const levels = await knex("product_variant_inventory_item as pvi")
        .join("inventory_level as il", "pvi.inventory_item_id", "il.inventory_item_id")
        .whereIn("pvi.variant_id", variantIds)
        .whereNull("il.deleted_at")
        .select(
          "il.location_id",
          "pvi.variant_id",
          knex.raw("(il.stocked_quantity - il.reserved_quantity) as available_quantity")
        )

      const capable = warehouses.filter((wh) => {
        return items.every((item) => {
          const vId = item.variant_id || item.variant?.id
          if (!vId) return true
          const lvl = levels.find(
            (l: any) => l.location_id === wh.id && l.variant_id === vId
          )
          if (!lvl) return false
          return Number(lvl.available_quantity) >= Number(item.quantity || 1)
        })
      })

      if (capable.length > 0) {
        if (capable.length < warehouses.length) {
          this.logger_.info?.(
            `[GHN Smart Routing] Filtered warehouses by inventory availability: ${capable.map((w: any) => w.name).join(", ")}`
          )
        }
        return capable
      }
    } catch (err: any) {
      this.logger_.warn?.(
        `[GHN Smart Routing] Inventory check error (continuing without filter): ${err?.message}`
      )
    }

    return warehouses
  }

  /**
   * Định tuyến kho thông minh (Smart Warehouse Routing):
   * Tự động chọn kho gửi hàng tối ưu dựa trên:
   * 1. Tồn kho thực tế (Inventory Level - chỉ chọn kho còn hàng)
   * 2. Vùng miền địa lý theo 34 Tỉnh v3 (Khách miền Bắc chọn Kho Bắc, khách miền Nam chọn Kho Nam)
   * 3. So sánh cước thực tế GHN (Miền Trung chọn kho có cước rẻ nhất)
   */
  async selectOptimalStockLocation({
    toProvinceId,
    toProvinceName,
    toDistrictId,
    toWardCode,
    toWardName,
    items,
    fallbackLocationId,
  }: {
    toProvinceId?: number
    toProvinceName: string
    toDistrictId?: number
    toWardCode?: string
    toWardName?: string
    items?: any[]
    fallbackLocationId?: string
  }): Promise<{
    id: string
    name: string
    company?: string
    address_1?: string
    city?: string
    province?: string
    phone?: string
    districtId: number
    wardCode: string
    wardName: string
    districtName: string
    provinceName: string
    provinceId?: number
    isNewAddress: boolean
    region?: "NORTH" | "SOUTH" | "CENTRAL"
  } | null> {
    const allWarehouses = await this.resolveAllStockLocations()
    if (!allWarehouses || allWarehouses.length === 0) {
      return this.resolveStockLocation(fallbackLocationId)
    }

    // 0. Ưu tiên số 1: Nếu Shipping Option gắn liền với 1 kho cụ thể (context.from_location)
    // và kho đó nằm trong danh sách kho hợp lệ có Fulfillment Set -> dùng chính xác kho này!
    if (fallbackLocationId) {
      const boundWh = allWarehouses.find((w) => w.id === fallbackLocationId)
      if (boundWh) {
        return boundWh
      }
    }

    if (allWarehouses.length === 1) {
      return allWarehouses[0]
    }

    // 1. Lọc kho còn hàng trong tồn kho
    const eligibleWarehouses = await this.filterWarehousesByInventory(
      allWarehouses,
      items || []
    )
    if (eligibleWarehouses.length === 1) {
      this.logger_.info?.(
        `[GHN Smart Routing] Only 1 warehouse has sufficient inventory: "${eligibleWarehouses[0].name}"`
      )
      return eligibleWarehouses[0]
    }

    // 2. Khớp vùng miền địa lý đích theo 34 Tỉnh v3 (Fast Geo Matching)
    const targetRegion = detectRegion({
      provinceId: toProvinceId,
      provinceName: toProvinceName,
    })
    this.logger_.info?.(
      `[GHN Smart Routing] Destination "${toProvinceName}" (ID: ${toProvinceId}) detected as Region: ${targetRegion}`
    )

    if (targetRegion === "NORTH") {
      const northWh = eligibleWarehouses.find(
        (w) =>
          w.region === "NORTH" ||
          w.name.toLowerCase().includes("north") ||
          w.name.toLowerCase().includes("bắc")
      )
      if (northWh) {
        this.logger_.info?.(
          `[GHN Smart Routing] Matched Northern warehouse: "${northWh.name}" for destination: "${toProvinceName}"`
        )
        return northWh
      }
    }

    if (targetRegion === "SOUTH") {
      const southWh = eligibleWarehouses.find(
        (w) =>
          w.region === "SOUTH" ||
          w.name.toLowerCase().includes("south") ||
          w.name.toLowerCase().includes("nam")
      )
      if (southWh) {
        this.logger_.info?.(
          `[GHN Smart Routing] Matched Southern warehouse: "${southWh.name}" for destination: "${toProvinceName}"`
        )
        return southWh
      }
    }

    // 3. Miền Trung (CENTRAL) hoặc trường hợp giáp ranh / không rõ vùng:
    // So sánh cước GHN thực tế giữa các kho ứng viên để chọn kho có cước rẻ nhất
    if (toProvinceName && toWardName) {
      try {
        const feePromises = eligibleWarehouses.map(async (wh) => {
          try {
            const preview = await this.client_.previewOrder({
              to_name: "Khách Hàng",
              to_phone: "0901234567",
              to_address: toWardName,
              to_ward_name: toWardName,
              to_province_name: toProvinceName,
              is_new_to_address: true,
              from_name: wh.company || wh.name,
              from_phone: wh.phone || "0901234567",
              from_address: wh.address_1 || "Kho hàng",
              from_ward_name: wh.wardName,
              from_district_name: wh.districtName,
              from_province_name: wh.provinceName,
              is_new_from_address: true,
              weight: 500,
              length: 10,
              width: 10,
              height: 10,
              service_type_id: 2,
              payment_type_id: 1,
              required_note: "CHOXEMHANGKHONGTHU",
            })
            return {
              warehouse: wh,
              fee: Number(preview.total_fee || preview.fee?.main_service || Infinity),
            }
          } catch {
            return { warehouse: wh, fee: Infinity }
          }
        })

        const feeResults = await Promise.all(feePromises)
        const validResults = feeResults.filter((r) => r.fee < Infinity)
        if (validResults.length > 0) {
          validResults.sort((a, b) => a.fee - b.fee)
          const best = validResults[0]
          this.logger_.info?.(
            `[GHN Smart Routing] Selected warehouse with lowest preview fee (${best.fee}₫): "${best.warehouse.name}" for "${toProvinceName}"`
          )
          return best.warehouse
        }
      } catch (err: any) {
        this.logger_.warn?.(
          `[GHN Smart Routing] Preview fee comparison failed: ${err?.message}`
        )
      }
    }

    if (toDistrictId) {
      try {
        const feePromises = eligibleWarehouses.map(async (wh) => {
          try {
            const fee = await this.client_.calculateFee({
              from_district_id: wh.districtId,
              from_ward_code: wh.wardCode,
              service_type_id: 2,
              to_district_id: toDistrictId,
              to_ward_code: toWardCode,
              weight: 500,
            })
            return { warehouse: wh, fee: fee.total }
          } catch {
            return { warehouse: wh, fee: Infinity }
          }
        })

        const feeResults = await Promise.all(feePromises)
        const validResults = feeResults.filter((r) => r.fee < Infinity)
        if (validResults.length > 0) {
          validResults.sort((a, b) => a.fee - b.fee)
          const best = validResults[0]
          this.logger_.info?.(
            `[GHN Smart Routing] Selected warehouse with lowest fee (${best.fee}₫): "${best.warehouse.name}" for "${toProvinceName}"`
          )
          return best.warehouse
        }
      } catch (err: any) {
        this.logger_.warn?.(
          `[GHN Smart Routing] Fee comparison failed, falling back to first warehouse: ${err?.message}`
        )
      }
    }

    return eligibleWarehouses[0]
  }

  constructor(container: InjectedDependencies, options: GhnModuleOptions) {
    super()

    this.logger_ = container.logger
    this.cache_ = container[Modules.CACHING]
    this.pgConnection_ =
      container[ContainerRegistrationKeys.PG_CONNECTION] ||
      (container as any)?.pgConnection ||
      null
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

      this.logger_.info?.(
        `[GHN calculatePrice] ======================== START CALCULATION ========================\n` +
        `  Cart ID        : ${(context as any)?.id || (context as any)?.cart?.id || "N/A"}\n` +
        `  item_total     : ${(context as any)?.item_total ?? "undefined"}₫\n` +
        `  subtotal       : ${(context as any)?.subtotal ?? "undefined"}₫\n` +
        `  discount_total : ${(context as any)?.discount_total ?? "undefined"}₫\n` +
        `  total          : ${(context as any)?.total ?? "undefined"}₫`
      )

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

      this.logger_.info?.(
        `[GHN calculatePrice] Destination parsed:\n` +
        `  Province : "${toProvinceName || "N/A"}"\n` +
        `  District : ID=${toDistrictId || "N/A"} (${mappedAddress?.districtName || "N/A"})\n` +
        `  Ward     : "${toWardName || "N/A"}" (code: ${toWardCode || "N/A"})\n` +
        `  Address1 : "${shippingAddress?.address_1 || "N/A"}"`
      )

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

      // Lấy danh sách adjustments (giảm giá/voucher/khuyến mãi) của các line items từ DB
      // Vì Medusa Core không nạp computed totals hoặc adjustments vào cartFieldsForCalculateShippingOptionsPrices
      const itemDiscounts: Record<string, number> = {}
      const itemIds = items.map((i: any) => i.id).filter(Boolean)
      if (itemIds.length > 0) {
        try {
          const knex = this.getPgConnection()
          const rows = await knex("cart_line_item_adjustment")
            .whereIn("item_id", itemIds)
            .whereNull("deleted_at")
            .select("item_id")
            .sum("amount as discount_amount")
            .groupBy("item_id")

          for (const row of rows) {
            itemDiscounts[row.item_id] = Number(row.discount_amount || 0)
          }
        } catch (dbErr: any) {
          this.logger_.warn?.(`[GHN calculatePrice] Could not query line item adjustments: ${dbErr?.message}`)
        }
      }

      // Map items sang cấu trúc GHN DTO:
      // Medusa v2 tự động tính toán và cung cấp item.total (đã trừ khuyến mãi/voucher) trên từng dòng sản phẩm
      const ghnItems: GhnOrderItem[] = items.map((item: any, idx: number) => {
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

        const qty = Math.max(1, Number(item?.quantity || 1))
        const itemDiscount = itemDiscounts[item?.id] || 0
        const rawLineTotal = item?.total !== undefined
          ? Number(item.total)
          : Math.max(0, Number(item?.unit_price || 0) * qty - itemDiscount)

        // Đơn giá thực tế sau khi phân bổ giảm giá (lineItem.total / qty)
        const netUnitPrice = Math.max(0, Math.round(rawLineTotal / qty))

        this.logger_.info?.(
          `[GHN calculatePrice] Item [${idx + 1}/${items.length}]: "${item?.title || item?.variant?.title || "Sản phẩm"}" | qty=${qty} | unit_price=${item?.unit_price || 0}₫ | discount=${itemDiscount}₫ | line_total=${rawLineTotal}₫ -> net_unit_price=${netUnitPrice}₫ (${Math.round(itemWeight)}g)`
        )

        return {
          name: item?.title || item?.variant?.title || "Sản phẩm",
          code: item?.variant?.sku || undefined,
          quantity: qty,
          price: netUnitPrice,
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

      this.logger_.info?.(
        `[GHN calculatePrice] Total cart weight: ${totalWeight}g from ${items.length} items`
      )

      // Fallback giá tạm tính khi không có địa chỉ người nhận nào
      if (!toDistrictId && !toProvinceName) {
        this.logger_.warn?.(
          "[GHN calculatePrice] No destination address found. Returning fallback fee 30.000₫."
        )
        return {
          calculated_amount: 30000,
          is_calculated_price_tax_inclusive: true,
        }
      }

      const effectiveToDistrict = toDistrictId || 1442 // Fallback Quận 1 nếu dùng form mặc định

      // Định tuyến kho thông minh (Smart Warehouse Routing):
      // Tự động phân tích địa chỉ nhận hàng theo 34 Tỉnh v3 và kiểm tra tồn kho (Inventory Level)
      // để chọn kho gần nhất, cước phí thấp nhất và giao hàng nhanh nhất.
      const fromLocation = (context as any)?.from_location
      const optimalWarehouse = await this.selectOptimalStockLocation({
        toProvinceId: metadata?.ghn_province_id ? Number(metadata.ghn_province_id) : undefined,
        toProvinceName: String(toProvinceName || ""),
        toDistrictId: effectiveToDistrict,
        toWardCode: toWardCode ? String(toWardCode) : undefined,
        toWardName: toWardName ? String(toWardName) : undefined,
        items,
        fallbackLocationId: fromLocation?.id,
      })

      const fromDistrictId = optimalWarehouse?.districtId || 3695
      const fromWardCode = optimalWarehouse?.wardCode || "90741"

      this.logger_.info?.(
        `[GHN Smart Routing] Selected Warehouse: "${optimalWarehouse?.name || "Default"}" (${optimalWarehouse?.provinceName || ""})\n` +
        `  fromDistrictId: ${fromDistrictId} | fromWardCode: ${fromWardCode}\n` +
        `  fromAddress   : "${optimalWarehouse?.address_1 || this.options_.fromAddress || ""}"`
      )

      // Resolve service_type_id động dựa vào tuyến đường và cân nặng
      let serviceTypeId: number
      serviceTypeId = await this.resolveServiceTypeId(
        fromDistrictId,
        effectiveToDistrict,
        totalWeight
      )

      // Khai giá bảo hiểm: lấy đúng 100% giá trị tiền hàng thực tế sau khuyến mãi.
      // Medusa v2 spread trực tiếp toàn bộ cart vào context: (context.item_total, context.total, context.items)
      const rawGoodsTotal = (context as any)?.item_total !== undefined
        ? Number((context as any).item_total)
        : (context as any)?.total !== undefined
        ? Number((context as any).total)
        : (context as any)?.cart?.item_total !== undefined
        ? Number((context as any).cart.item_total)
        : items.reduce((sum: number, it: any) => {
            const itDiscount = itemDiscounts[it?.id] || 0
            const itTotal = it?.total !== undefined
              ? Number(it.total)
              : Math.max(0, Number(it?.unit_price || 0) * Number(it?.quantity || 1) - itDiscount)
            return sum + itTotal
          }, 0)

      const goodsTotal = Math.max(0, Math.round(rawGoodsTotal))
      const insuranceValue = this.options_.maxInsuranceValue
        ? Math.min(this.options_.maxInsuranceValue, goodsTotal)
        : goodsTotal

      this.logger_.info?.(
        `[GHN calculatePrice] Insurance Value Calculation:\n` +
        `  rawGoodsTotal   : ${rawGoodsTotal}₫ (from context.item_total / context.total / sum(item.total))\n` +
        `  goodsTotal      : ${goodsTotal}₫\n` +
        `  insuranceValue  : ${insuranceValue}₫\n` +
        `  GHN Fee Policy  : <= 1.000.000₫ => 0₫ fee | > 1.000.000₫ => 0.5% surcharge`
      )

      // =========================================================================
      // CHIẾN LƯỢC 1 (ƯU TIÊN): TÍNH PHÍ BẰNG API PREVIEW (/v2/shipping-order/preview)
      // Khi khách dùng mô hình 2 cấp mới (GHN v3) hoặc có tên Tỉnh + Phường/Xã:
      // Engine Geocoding của GHN tự phân giải chính xác tuyến huyện/xã và trả về:
      // 1. Phí cước chính xác 100% khớp với lúc Tạo đơn (Fulfillment)
      // 2. Thời gian giao hàng dự kiến (expected_delivery_time)
      // =========================================================================
      if (toProvinceName && toWardName) {
        const recipientName =
          [shippingAddress?.first_name, shippingAddress?.last_name]
            .filter(Boolean)
            .join(" ")
            .trim()
            .slice(0, 1024) || "Khách Hàng"

        const recipientPhone = String(
          shippingAddress?.phone || (context as any)?.cart?.customer?.phone || "0901234567"
        ).trim()

        const recipientAddress = (
          shippingAddress?.address_1 ||
          [shippingAddress?.address_1, shippingAddress?.address_2].filter(Boolean).join(", ") ||
          toWardName ||
          "Địa chỉ nhận hàng"
        ).trim().slice(0, 1024)

        const fromName = String(
          optimalWarehouse?.company ||
          optimalWarehouse?.name ||
          this.options_.fromName ||
          "South Warehouse"
        ).slice(0, 1024)

        const fromPhone = String(
          optimalWarehouse?.phone ||
          this.options_.fromPhone ||
          "0901234567"
        )

        const fromAddress = String(
          optimalWarehouse?.address_1 ||
          this.options_.fromAddress ||
          "123 Đường Hiệp Bình, Phường Hiệp Bình, TP. Hồ Chí Minh"
        ).slice(0, 1024)

        const fromWardName = String(
          optimalWarehouse?.wardName ||
          this.options_.fromWardName ||
          "Phường Hiệp Bình"
        )

        const fromDistrictName = String(
          optimalWarehouse?.districtName ||
          this.options_.fromDistrictName ||
          "Thành Phố Thủ Đức"
        )

        const fromProvinceName = String(
          optimalWarehouse?.provinceName ||
          this.options_.fromProvinceName ||
          "Hồ Chí Minh"
        )

        const previewPayload: GhnCreateOrderRequest = {
          to_name: recipientName,
          to_phone: recipientPhone,
          to_address: recipientAddress,
          to_ward_name: toWardName,
          to_province_name: toProvinceName,
          is_new_to_address: true,

          from_name: fromName,
          from_phone: fromPhone,
          from_address: fromAddress,
          from_ward_name: fromWardName,
          from_district_name: fromDistrictName,
          from_province_name: fromProvinceName,
          is_new_from_address: true,

          weight: Math.round(totalWeight),
          length: this.options_.defaultDimensions?.length || 10,
          width: this.options_.defaultDimensions?.width || 10,
          height: this.options_.defaultDimensions?.height || 10,

          service_type_id: (serviceTypeId === 5 ? 5 : 2),
          payment_type_id: 1,
          required_note: "CHOXEMHANGKHONGTHU",
          insurance_value: insuranceValue,
          items: ghnItems,
        }

        try {
          this.logger_.info?.(
            `[GHN calculatePrice] Sending PREVIEW request (/v2/shipping-order/preview):\n` +
            `  From    : "${fromName}" (${fromPhone}) - ${fromAddress}, ${fromWardName}, ${fromDistrictName}, ${fromProvinceName}\n` +
            `  To      : "${recipientName}" (${recipientPhone}) - ${recipientAddress}, ${toWardName}, ${toProvinceName}\n` +
            `  Weight  : ${previewPayload.weight}g | Service Type: ${previewPayload.service_type_id} | Insurance: ${previewPayload.insurance_value}₫\n` +
            `  Items (${previewPayload.items?.length || 0}): ${JSON.stringify(previewPayload.items)}`
          )
          const previewData = await this.client_.previewOrder(previewPayload)

          if (previewData && typeof previewData.total_fee === "number") {
            const calculatedAmount = Number(previewData.total_fee || previewData.fee?.main_service || 0)
            this.logger_.info?.(
              `[GHN calculatePrice] Preview SUCCESS:\n` +
              `  Calculated Amount : ${calculatedAmount}₫\n` +
              `  Main Service Fee  : ${previewData.fee?.main_service || 0}₫\n` +
              `  Insurance Fee     : ${previewData.fee?.insurance || 0}₫\n` +
              `  Expected Delivery : ${previewData.expected_delivery_time || "N/A"}\n` +
              `  Sort Code         : ${previewData.sort_code || "N/A"}\n` +
              `[GHN calculatePrice] ======================== END CALCULATION SUCCESS ========================`
            )

            return {
              calculated_amount: calculatedAmount,
              is_calculated_price_tax_inclusive: true,
              data: {
                expected_delivery_time: previewData.expected_delivery_time,
                leadtime: previewData.expected_delivery_time,
                ghn_trans_type: previewData.trans_type,
                ghn_sort_code: previewData.sort_code,
                main_service_fee: previewData.fee?.main_service,
                insurance_fee: previewData.fee?.insurance,
                from_warehouse_id: optimalWarehouse?.id,
                from_warehouse_name: optimalWarehouse?.name,
              },
            } as any as CalculatedShippingOptionPrice
          }
        } catch (previewErr: any) {
          // Nếu preview với gói 5 fail, tự động retry với gói 2
          if (previewPayload.service_type_id === 5) {
            try {
              previewPayload.service_type_id = 2
              this.logger_.warn?.(
                `[GHN calculatePrice] Preview with service_type_id=5 failed (${previewErr?.message}), retrying with service_type_id=2...`
              )
              const retryData = await this.client_.previewOrder(previewPayload)
              if (retryData && typeof retryData.total_fee === "number") {
                const calculatedAmount = Number(retryData.total_fee || retryData.fee?.main_service || 0)
                this.logger_.info?.(
                  `[GHN calculatePrice] Preview Retry SUCCESS (service_type_id=2):\n` +
                  `  Calculated Amount : ${calculatedAmount}₫\n` +
                  `  Main Service Fee  : ${retryData.fee?.main_service || 0}₫\n` +
                  `  Insurance Fee     : ${retryData.fee?.insurance || 0}₫\n` +
                  `  Expected Delivery : ${retryData.expected_delivery_time || "N/A"}\n` +
                  `[GHN calculatePrice] ======================== END CALCULATION SUCCESS ========================`
                )
                return {
                  calculated_amount: calculatedAmount,
                  is_calculated_price_tax_inclusive: true,
                  data: {
                    expected_delivery_time: retryData.expected_delivery_time,
                    leadtime: retryData.expected_delivery_time,
                    ghn_trans_type: retryData.trans_type,
                    ghn_sort_code: retryData.sort_code,
                    main_service_fee: retryData.fee?.main_service,
                    insurance_fee: retryData.fee?.insurance,
                    from_warehouse_id: optimalWarehouse?.id,
                    from_warehouse_name: optimalWarehouse?.name,
                  },
                } as any as CalculatedShippingOptionPrice
              }
            } catch (retryErr: any) {
              this.logger_.warn?.(
                `[GHN calculatePrice] Preview failed on both service_type_id 5 & 2 (${retryErr?.message}), falling back to legacy fee API`
              )
            }
          } else {
            this.logger_.warn?.(
              `[GHN calculatePrice] Preview failed (${previewErr?.message}), falling back to legacy fee API`
            )
          }
        }
      }

      // =========================================================================
      // CHIẾN LƯỢC 2 (FALLBACK): TÍNH PHÍ BẰNG API LEGACY (/v2/shipping-order/fee)
      // Dành cho trường hợp thiếu tên xã hoặc khi API preview gặp sự cố mạng
      // =========================================================================
      const feePayload: GhnFeeRequest = {
        from_district_id: fromDistrictId,
        from_ward_code: fromWardCode,
        service_type_id: serviceTypeId,
        weight: Math.round(totalWeight),
        insurance_value: insuranceValue,
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
        `[GHN calculatePrice] Executing FALLBACK Fee API (/v2/shipping-order/fee):\n` +
        `  Route: ${fromDistrictId} -> ${feePayload.to_district_id} (Ward: ${feePayload.to_ward_code})\n` +
        `  Service Type: ${feePayload.service_type_id} | Weight: ${feePayload.weight}g | Insurance: ${feePayload.insurance_value}₫`
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
            `[GHN calculatePrice] Calculate fee failed with service_type_id=5 (${err?.message}), falling back to service_type_id=2`
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
            `[GHN calculatePrice] Calculate fee failed with service_type_id=2 (${err?.message}), retrying with service_type_id=5`
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
        `[GHN calculatePrice] Fallback fee SUCCESS:\n` +
        `  Total Fee     : ${feeData.total}₫\n` +
        `  Service Fee   : ${feeData.service_fee}₫\n` +
        `  Insurance Fee : ${feeData.insurance_fee || 0}₫\n` +
        `[GHN calculatePrice] ======================== END CALCULATION SUCCESS ========================`
      )

      return {
        calculated_amount: Number(feeData.total || 0),
        is_calculated_price_tax_inclusive: true,
        data: {
          main_service_fee: feeData.service_fee,
          insurance_fee: feeData.insurance_fee,
          from_warehouse_id: optimalWarehouse?.id,
          from_warehouse_name: optimalWarehouse?.name,
        },
      } as any as CalculatedShippingOptionPrice
    } catch (error: any) {
      this.logger_.error?.(
        `[GHN calculatePrice] Calculate price FAILED with error: ${error?.message}`,
        error
      )
      this.logger_.info?.(
        `[GHN calculatePrice] Returning fallback amount: 35.000₫\n` +
        `[GHN calculatePrice] ======================== END CALCULATION ERROR ========================`
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

    // Khách hàng có chủ động nhập hoặc chọn Quận/Huyện từ trước hay không?
    const hasExplicitDistrict = Boolean(
      metadata?.ghn_district_id ||
      metadata?.district_id ||
      metadata?.ghn_district_name ||
      metadata?.district_name
    )

    // Xác định định dạng địa chỉ người nhận:
    // - true (mô hình 2 cấp GHN v3):
    //    1. Bật cấu hình useNewAddressFormat: true trong plugin options
    //    2. HOẶC metadata.is_new_to_address === true
    //    3. HOẶC khách chọn từ danh sách 34 tỉnh v3 (ghn_province_id)
    //    4. HOẶC khách không có thông tin quận/huyện cụ thể từ form (hasExplicitDistrict = false)
    // - false (mô hình 3 cấp cũ): Khách có nhập rõ Quận/Huyện và không kích hoạt mô hình mới
    const useNewAddress = Boolean(
      this.options_.useNewAddressFormat ||
      metadata?.is_new_to_address === true ||
      metadata?.ghn_province_id ||
      !hasExplicitDistrict
    )

    // Khi dùng địa chỉ mới 2 cấp (v3), ưu tiên tên tỉnh theo chuẩn 34 tỉnh mới (v3_name)
    const toProvinceName = String(
      (useNewAddress ? (metadata?.ghn_province_name || mappedOrderAddress?.v3ProvinceName) : null) ||
      metadata?.ghn_province_name ||
      shippingAddress?.province ||
      mappedOrderAddress?.provinceName ||
      metadata?.province_name ||
      shippingAddress?.city ||
      ""
    ).trim()

    const toDistrictName = String(
      metadata?.ghn_district_name ||
      metadata?.district_name ||
      (useNewAddress ? "" : mappedOrderAddress?.districtName) ||
      ""
    ).trim()

    const toWardName = String(
      metadata?.ghn_ward_name ||
      shippingAddress?.city || // Trong Storefront mô hình 2 cấp, city chứa Tên Phường/Xã
      mappedOrderAddress?.wardName ||
      metadata?.ward_name ||
      shippingAddress?.address_2 ||
      ""
    ).trim()

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

      // 4. Đơn giá thực tế (VND): ưu tiên đơn giá sau phân bổ khuyến mãi (lineItem.total / qty)
      const qty = Math.max(1, Math.round(Number(item.quantity || lineItem?.quantity || 1)))
      const lineItemDiscountedTotal = lineItem?.total !== undefined
        ? Number(lineItem.total)
        : lineItem?.subtotal !== undefined
        ? Math.max(0, Number(lineItem.subtotal) - Number(lineItem?.discount_total || 0))
        : undefined

      const finalPrice = lineItemDiscountedTotal !== undefined
        ? Math.max(0, Math.round(lineItemDiscountedTotal / qty))
        : Math.max(0, Number(lineItem?.unit_price ?? item.unit_price ?? 0))

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

    const toDistrictId = Number(
      mappedOrderAddress?.districtId || metadata?.ghn_district_id || metadata?.district_id || 1442
    )

    // Khối thông tin người gửi (from):
    // Tầng 1: Ưu tiên additional_data (nếu caller, custom API hoặc workflow truyền vào -> không tốn query DB)
    const customFrom = (
      additionalData?.stock_location ||
      additionalData?.from_location ||
      additionalData?.sender ||
      additionalData
    ) as Record<string, any> | undefined

    const hasCustomSender = Boolean(
      customFrom?.from_address ||
      customFrom?.address_1 ||
      customFrom?.from_district_id ||
      customFrom?.district_id ||
      customFrom?.from_ward_code ||
      customFrom?.ward_code
    )

    const targetLocationId =
      (fulfillment as any)?.location_id ||
      customFrom?.location_id ||
      additionalData?.location_id

    // Tầng 2: Lấy thông tin kho gửi hàng theo đúng kho mà Admin đã chọn (fulfillment.location_id)
    const resolvedStockLocation = hasCustomSender
      ? null
      : await this.resolveStockLocation(targetLocationId)


    const senderDistrictId =
      customFrom?.from_district_id ||
      resolvedStockLocation?.districtId ||
      this.options_.fromDistrictId ||
      3695

    // Resolve service_type_id động tại thời điểm tạo đơn: 2 (<20kg) hoặc 5 (>=20kg)
    let serviceTypeId: 2 | 5 = totalWeight >= 20_000 ? 5 : 2
    try {
      const resolved = await this.resolveServiceTypeId(
        senderDistrictId,
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

    // Giá trị đơn hàng & COD & Hình thức thanh toán cước
    const orderTotal = Math.round(Number((order as any)?.total ?? 0))
    const shippingTotal = Math.round(Number((order as any)?.shipping_total ?? 0))
    const isPaid = (order as any)?.payment_status === "captured"
    const isCodPayment =
      metadata?.payment_method === "cod" ||
      additionalData?.is_cod === true ||
      (!isPaid && metadata?.cod_amount !== undefined)

    // Xác định payment_type_id:
    // 1: Người gửi trả cước (Shop trả)
    // 2: Người nhận trả cước (Khách tự trả tiền ship cho shipper khi nhận hàng)
    //
    // Quy tắc an toàn E-commerce:
    // - Đơn đã thanh toán online (isPaid) -> BẮT BUỘC là 1 (vì khách đã thanh toán ship trên web, không để shipper thu thêm lần 2).
    // - Đơn được Free Ship (shippingTotal === 0) -> BẮT BUỘC là 1 (vì Shop tài trợ cước cho khách).
    // - Đơn COD: mặc định là 1 (Chuẩn E-commerce thu trọn gói đối soát) hoặc 2 nếu Shop chủ động cấu hình.
    let resolvedPaymentTypeId: 1 | 2 = 1
    if (isPaid || shippingTotal === 0) {
      resolvedPaymentTypeId = 1
    } else if (additionalData?.payment_type_id !== undefined) {
      resolvedPaymentTypeId = Number(additionalData.payment_type_id) === 2 ? 2 : 1
    } else if (this.options_.paymentTypeId !== undefined) {
      resolvedPaymentTypeId = Number(this.options_.paymentTypeId) === 2 ? 2 : 1
    }

    let codAmount = 0
    if (additionalData?.cod_amount !== undefined) {
      codAmount = Math.max(0, Math.round(Number(additionalData.cod_amount)))
    } else if (metadata?.cod_amount !== undefined) {
      codAmount = Math.max(0, Math.round(Number(metadata.cod_amount)))
    } else if (isCodPayment && !isPaid && orderTotal > 0) {
      if (resolvedPaymentTypeId === 2) {
        // Người nhận tự trả cước cho shipper: COD chỉ thu tiền hàng thuần túy (tránh khách bị thu ship 2 lần)
        const goodsOnly = Math.max(0, orderTotal - shippingTotal)
        codAmount = Math.min(50_000_000, goodsOnly)
      } else {
        // Chuẩn E-commerce (payment_type_id = 1): COD thu trọn gói orderTotal (tiền hàng + tiền ship)
        // GHN sẽ đối soát trừ cước ship và hoàn tiền hàng lại cho Shop.
        codAmount = Math.min(50_000_000, orderTotal)
      }
    }

    // Giá trị khai giá bảo hiểm: chỉ tính trên giá trị thực tế của hàng hóa sau khuyến mãi (item_total)
    // Medusa v2 tự động cung cấp computed field `order.item_total` (subtotal - discount_total).
    const itemsTotal = ghnItems.reduce(
      (sum, item) => sum + (item.price || 0) * item.quantity,
      0
    )
    const orderItemTotal = (order as any)?.item_total !== undefined
      ? Math.round(Number((order as any).item_total))
      : (order as any)?.subtotal !== undefined
      ? Math.round(Math.max(0, Number((order as any).subtotal) - Number((order as any)?.discount_total || 0)))
      : undefined

    const goodsValue =
      orderItemTotal !== undefined && orderItemTotal >= 0
        ? orderItemTotal
        : itemsTotal > 0
        ? itemsTotal
        : Math.round(Number((order as any)?.subtotal ?? orderTotal))

    let insuranceValue = this.options_.maxInsuranceValue
      ? Math.min(this.options_.maxInsuranceValue, Math.max(0, goodsValue))
      : Math.max(0, goodsValue)

    if (additionalData?.insurance_value !== undefined) {
      const explicitIns = Math.max(0, Math.round(Number(additionalData.insurance_value)))
      insuranceValue = this.options_.maxInsuranceValue
        ? Math.min(this.options_.maxInsuranceValue, explicitIns)
        : explicitIns
    }
    const orderValue = Math.max(0, goodsValue)

    this.logger_.info?.(
      `[GHN Fulfillment] Insurance Value determined:\n` +
      `  orderItemTotal : ${orderItemTotal ?? "undefined"}₫ | itemsTotal: ${itemsTotal}₫ | orderTotal: ${orderTotal}₫\n` +
      `  goodsValue     : ${goodsValue}₫\n` +
      `  insuranceValue : ${insuranceValue}₫ (GHN Policy: <= 1.000.000₫ => 0₫ fee, > 1.000.000₫ => 0.5% surcharge)`
    )

    const orderRef = (order as any)?.display_id
      ? `ORD-${(order as any)?.display_id}`
      : (order as any)?.id || "FUL"

    // Gắn suffix định danh fulfillment (8 ký tự cuối) để vừa chống tạo trùng (idempotent)
    // khi retry cùng 1 fulfillment, vừa hỗ trợ giao hàng nhiều đợt (partial fulfillments)
    // không bị GHN nhận nhầm thành đơn cũ. Tối đa 50 ký tự theo quy định GHN.
    const fulfillmentSuffix = fulfillment?.id
      ? `-${fulfillment.id.replace(/^ful_/, "").slice(-8)}`
      : ""

    const clientOrderCode = `${orderRef}${fulfillmentSuffix}`.slice(0, 50)

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

      // 3. Khối dịch vụ & thanh toán (Bắt buộc) - Ưu tiên additional_data nếu caller truyền vào
      service_type_id: serviceTypeId,
      payment_type_id: resolvedPaymentTypeId,
      required_note: (String(
        additionalData?.required_note ||
        additionalData?.carrier_instruction ||
        this.options_.requiredNote ||
        "CHOXEMHANGKHONGTHU"
      ) as "KHONGCHOXEMHANG" | "CHOXEMHANGKHONGTHU" | "CHOTHUHANG"),

      // 4. Khối thông tin đơn hàng & thu hộ
      client_order_code: clientOrderCode || undefined,
      content: contentDescription,
      note: String(additionalData?.note || driverNote || "").trim() || undefined,
      cod_amount: codAmount,
      cod_failed_amount: 0,
      insurance_value: insuranceValue,
      order_value: orderValue,

      // 5. Danh sách sản phẩm
      items: ghnItems,
    }

    const fromName = String(
      customFrom?.from_name ||
      customFrom?.name ||
      customFrom?.company ||
      resolvedStockLocation?.company ||
      resolvedStockLocation?.name ||
      this.options_.fromName ||
      "South Warehouse"
    ).slice(0, 1024)

    const fromPhone = String(
      customFrom?.from_phone ||
      customFrom?.phone ||
      resolvedStockLocation?.phone ||
      this.options_.fromPhone ||
      "0901234567"
    )

    const fromAddress = String(
      customFrom?.from_address ||
      customFrom?.address_1 ||
      resolvedStockLocation?.address_1 ||
      this.options_.fromAddress ||
      "123 Đường Hiệp Bình, Phường Hiệp Bình, TP. Hồ Chí Minh"
    ).slice(0, 1024)

    const fromWardName = String(
      customFrom?.from_ward_name ||
      customFrom?.ward_name ||
      customFrom?.wardName ||
      resolvedStockLocation?.wardName ||
      this.options_.fromWardName ||
      "Phường Hiệp Bình"
    )

    const fromDistrictName = String(
      customFrom?.from_district_name ||
      customFrom?.district_name ||
      customFrom?.districtName ||
      resolvedStockLocation?.districtName ||
      this.options_.fromDistrictName ||
      "Thành Phố Thủ Đức"
    )

    const fromProvinceName = String(
      customFrom?.from_province_name ||
      customFrom?.province_name ||
      customFrom?.provinceName ||
      resolvedStockLocation?.provinceName ||
      this.options_.fromProvinceName ||
      "Hồ Chí Minh"
    )

    createOrderPayload.from_name = fromName
    createOrderPayload.from_phone = fromPhone
    if (this.options_.fromHotline) createOrderPayload.from_hotline = this.options_.fromHotline
    createOrderPayload.from_address = fromAddress
    createOrderPayload.from_ward_name = fromWardName
    createOrderPayload.from_district_name = fromDistrictName
    createOrderPayload.from_province_name = fromProvinceName
    createOrderPayload.is_new_from_address = Boolean(
      customFrom?.is_new_from_address ??
      this.options_.isNewFromAddress ??
      resolvedStockLocation?.isNewAddress ??
      true
    )

    // Khối thông tin trả hàng (return) - nếu shop có cấu hình
    if (this.options_.returnName) createOrderPayload.return_name = this.options_.returnName.slice(0, 1024)
    if (this.options_.returnPhone) createOrderPayload.return_phone = this.options_.returnPhone
    if (this.options_.returnAddress) createOrderPayload.return_address = this.options_.returnAddress.slice(0, 1024)
    if (this.options_.returnWardName) createOrderPayload.return_ward_name = this.options_.returnWardName
    if (this.options_.returnDistrictName) createOrderPayload.return_district_name = this.options_.returnDistrictName
    if (this.options_.returnProvinceName) createOrderPayload.return_province_name = this.options_.returnProvinceName
    if (this.options_.isNewReturnAddress !== undefined) createOrderPayload.is_new_return_address = this.options_.isNewReturnAddress

    this.logger_.info?.(
      `[GHN Fulfillment] Submitting createOrder to GHN:\n` +
      `  Client Code : ${clientOrderCode}\n` +
      `  From        : "${createOrderPayload.from_name}" (${createOrderPayload.from_phone}) - ${createOrderPayload.from_address}, ${createOrderPayload.from_ward_name}, ${createOrderPayload.from_district_name}, ${createOrderPayload.from_province_name}\n` +
      `  To          : "${recipientName}" (${recipientPhone}) - ${createOrderPayload.to_address}, ${toWardName}, ${toProvinceName}\n` +
      `  Weight      : ${createOrderPayload.weight}g | COD: ${createOrderPayload.cod_amount}₫ | Insurance: ${createOrderPayload.insurance_value}₫\n` +
      `  Items (${createOrderPayload.items?.length || 0}): ${JSON.stringify(createOrderPayload.items)}`
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
      `[GHN Fulfillment] Order created successfully:\n` +
      `  GHN Code      : ${orderCode}\n` +
      `  Total Fee     : ${ghnOrder.total_fee}₫\n` +
      `  Sort Code     : ${ghnOrder.sort_code}\n` +
      `  Expected Time : ${ghnOrder.expected_delivery_time}`
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
        client_order_code: clientOrderCode,
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
