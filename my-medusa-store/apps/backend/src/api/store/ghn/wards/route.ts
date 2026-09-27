import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { ICachingModuleService, Logger } from "@medusajs/framework/types"
import { GhnClient } from "../../../../modules/giao-hang-nhanh/client"

const WARDS_CACHE_PREFIX = "ghn:v3:wards:"
const CACHE_TTL_SECONDS = 24 * 60 * 60 // 24 giờ

/**
 * GET /store/ghn/wards?province_id=1000001
 *
 * Lấy danh sách Phường/Xã mới nhất của GHN (v3 API) trực thuộc Tỉnh/Thành phố.
 * Chuẩn response đồng nhất 100% với tài liệu GHN Developer,
 * có mảng `extension_names` chứa các biến thể tên để autocomplete / gợi ý khi gõ tìm kiếm.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as Logger
  const provinceId = Number(req.query.province_id)

  if (!provinceId) {
    return res.status(400).json({
      code: 400,
      message: "Tham số province_id là bắt buộc (ví dụ: ?province_id=1000001 cho TP. Hồ Chí Minh)",
      data: null,
    })
  }

  const cacheKey = `${WARDS_CACHE_PREFIX}${provinceId}`

  let cachingService: ICachingModuleService | undefined
  try {
    cachingService = req.scope.resolve(Modules.CACHING) as ICachingModuleService
  } catch {
    // Caching module optional
  }

  // 1. Kiểm tra cache Redis
  if (cachingService) {
    try {
      const cached = await cachingService.get({ key: cacheKey })
      if (cached) {
        logger?.debug?.(`[GHN API] Cache HIT for wards v3 (province_id=${provinceId})`)
        return res.json(cached)
      }
    } catch (err: any) {
      logger?.warn?.(`[GHN API] Cache read error: ${err?.message}`)
    }
  }

  // 2. Fetch từ GHN API v3 (/v3/master-data/ward/all-by-province-id)
  try {
    const client = new GhnClient(
      {
        token: process.env.GHN_API_TOKEN || "",
        shopId: Number(process.env.GHN_SHOP_ID || 0),
        endpoint: process.env.GHN_ENDPOINT,
        mockEnabled: process.env.GHN_MOCK_ENABLED === "true",
      },
      logger
    )

    const wards = await client.getWardsV3(provinceId)

    const responseData = {
      code: 200,
      message: "Success",
      data: wards,
    }

    // 3. Ghi cache Redis
    if (cachingService && wards?.length > 0) {
      cachingService
        .set({
          key: cacheKey,
          data: responseData,
          ttl: CACHE_TTL_SECONDS,
        })
        .catch((err) => {
          logger?.warn?.(`[GHN API] Cache write error: ${err?.message}`)
        })
    }

    return res.json(responseData)
  } catch (error: any) {
    logger?.error?.(`[GHN API] Error fetching wards: ${error?.message}`, error)
    return res.status(500).json({
      code: 500,
      message: error?.message || "Internal server error fetching wards",
      data: null,
    })
  }
}
