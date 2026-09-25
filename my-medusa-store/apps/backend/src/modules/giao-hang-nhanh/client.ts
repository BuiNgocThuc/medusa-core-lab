/**
 * GHN REST API Client wrapper
 */
import { MedusaError } from "@medusajs/framework/utils"
import type { Logger } from "@medusajs/framework/types"
import type {
  GhnApiResponse,
  GhnCancelOrderResponseData,
  GhnCreateOrderRequest,
  GhnCreateOrderResponseData,
  GhnDistrict,
  GhnFeeRequest,
  GhnFeeResponseData,
  GhnModuleOptions,
  GhnProvince,
  GhnWard,
} from "./types"

const DEFAULT_ENDPOINT = "https://dev-online-gateway.ghn.vn/shiip/public-api"

export class GhnClient {
  private readonly endpoint: string
  private readonly token: string
  private readonly shopId: number
  private readonly mockEnabled: boolean
  private readonly logger?: Logger

  constructor(options: GhnModuleOptions, logger?: Logger) {
    this.endpoint = options.endpoint || DEFAULT_ENDPOINT
    this.token = options.token || ""
    this.shopId = Number(options.shopId) || 0
    this.mockEnabled = Boolean(options.mockEnabled)
    this.logger = logger
  }

  private async request<T>(
    path: string,
    method: "GET" | "POST",
    body?: any,
    requireShopId = true
  ): Promise<T> {
    const url = `${this.endpoint}${path.startsWith("/") ? path : `/${path}`}`

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Token: this.token,
    }

    if (requireShopId && this.shopId) {
      headers["ShopId"] = String(this.shopId)
    }

    this.logger?.debug?.(`[GHN Client] ${method} ${url} - Body: ${JSON.stringify(body || {})}`)

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      })

      const json = (await response.json()) as GhnApiResponse<T>

      if (!response.ok || (json.code !== 200 && json.code !== 201)) {
        const errorMsg = json.message || `GHN API Error status: ${response.status}`
        this.logger?.error?.(`[GHN Client] Request error: ${errorMsg}`, new Error(JSON.stringify(json)))
        throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `GHN Error: ${errorMsg}`)
      }

      return json.data
    } catch (err: any) {
      if (err instanceof MedusaError) {
        throw err
      }
      this.logger?.error?.(`[GHN Client] Network/unexpected error: ${err?.message}`, err)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `GHN Network Error: ${err?.message || "Unknown error"}`
      )
    }
  }

  /**
   * Tính phí giao hàng
   */
  async calculateFee(request: GhnFeeRequest): Promise<GhnFeeResponseData> {
    if (this.mockEnabled || !this.token) {
      this.logger?.info?.("[GHN Mock] Calculating mock shipping fee")
      // Mock fee logic dựa trên cân nặng và khoảng cách giả lập
      const baseFee = 25000
      const weightFee = Math.max(0, Math.ceil((request.weight - 500) / 500)) * 5000
      const total = baseFee + weightFee

      return {
        total,
        service_fee: total,
        insurance_fee: 0,
        pick_station_fee: 0,
        coupon_value: 0,
        r2s_fee: 0,
        document_return: 0,
        double_check: 0,
        cod_fee: 0,
        pick_remote_areas_fee: 0,
        deliver_remote_areas_fee: 0,
        cod_failed_fee: 0,
      }
    }

    return await this.request<GhnFeeResponseData>("/v2/shipping-order/fee", "POST", request, true)
  }

  /**
   * Tạo đơn vận chuyển GHN
   */
  async createOrder(request: GhnCreateOrderRequest): Promise<GhnCreateOrderResponseData> {
    if (this.mockEnabled || !this.token) {
      this.logger?.info?.("[GHN Mock] Creating mock GHN shipping order")
      const mockOrderCode = `GHN_MOCK_${Date.now().toString().slice(-6)}`
      return {
        order_code: mockOrderCode,
        sort_code: "MOCK-SORT",
        trans_type: "truck",
        ward_encode: "MOCK",
        district_encode: "MOCK",
        fee: {
          main_service: 25000,
          insurance: 0,
          station_do: 0,
          station_pu: 0,
          return: 0,
          r2s: 0,
          coupon: 0,
          cod_failed_fee: 0,
        },
        total_fee: 25000,
        expected_delivery_time: new Date(Date.now() + 3 * 86400000).toISOString(),
      }
    }

    return await this.request<GhnCreateOrderResponseData>(
      "/v2/shipping-order/create",
      "POST",
      request,
      true
    )
  }

  /**
   * Hủy đơn vận chuyển GHN
   */
  async cancelOrder(orderCodes: string[]): Promise<GhnCancelOrderResponseData[]> {
    if (this.mockEnabled || !this.token) {
      this.logger?.info?.(`[GHN Mock] Cancelling mock orders: ${orderCodes.join(", ")}`)
      return orderCodes.map((code) => ({
        order_code: code,
        result: true,
        message: "Hủy đơn hàng thành công (Mock)",
      }))
    }

    return await this.request<GhnCancelOrderResponseData[]>(
      "/v2/switch-status/cancel",
      "POST",
      { order_codes: orderCodes },
      true
    )
  }

  /**
   * Lấy token in phiếu gửi hàng A5
   */
  async getPrintToken(orderCodes: string[]): Promise<string> {
    if (this.mockEnabled || !this.token) {
      return "mock_print_token"
    }

    const data = await this.request<{ token: string }>(
      "/v2/a5/gen-token",
      "POST",
      { order_codes: orderCodes },
      false
    )
    return data.token
  }

  /**
   * Sinh đường dẫn in phiếu gửi hàng
   */
  getPrintUrl(printToken: string, paperSize: "printA5" | "print80x80" | "print52x70" = "printA5"): string {
    const baseUrl = this.endpoint.includes("dev-online-gateway")
      ? "https://dev-online-gateway.ghn.vn/a5/public-api"
      : "https://online-gateway.ghn.vn/a5/public-api"
    return `${baseUrl}/${paperSize}?token=${printToken}`
  }

  /**
   * Lấy danh sách Tỉnh/Thành phố
   */
  async getProvinces(): Promise<GhnProvince[]> {
    return await this.request<GhnProvince[]>("/master-data/province", "GET", undefined, false)
  }

  /**
   * Lấy danh sách Quận/Huyện theo Tỉnh/Thành
   */
  async getDistricts(provinceId: number): Promise<GhnDistrict[]> {
    return await this.request<GhnDistrict[]>(
      "/master-data/district",
      "POST",
      { province_id: provinceId },
      false
    )
  }

  /**
   * Lấy danh sách Phường/Xã theo Quận/Huyện
   */
  async getWards(districtId: number): Promise<GhnWard[]> {
    return await this.request<GhnWard[]>(
      "/master-data/ward",
      "POST",
      { district_id: districtId },
      false
    )
  }
}
