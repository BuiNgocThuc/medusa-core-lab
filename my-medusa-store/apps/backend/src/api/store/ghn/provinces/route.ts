import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { ICachingModuleService, Logger } from "@medusajs/framework/types"
import { GhnClient } from "../../../../modules/giao-hang-nhanh/client"

const PROVINCES_CACHE_KEY = "ghn:v3:provinces:all"
const CACHE_TTL_SECONDS = 24 * 60 * 60 // 24 giờ

/**
 * GET /store/ghn/provinces
 *
 * Lấy danh sách 34 Tỉnh/Thành phố mới nhất của Việt Nam (GHN v3 API).
 * Chuẩn response đồng nhất 100% với tài liệu GHN Developer,
 * đặc biệt có mảng `extension_names` chứa các biến thể tên để autocomplete / gợi ý khi gõ tìm kiếm.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as Logger
  let cachingService: ICachingModuleService | undefined

  try {
    cachingService = req.scope.resolve(Modules.CACHING) as ICachingModuleService
  } catch {
    // Caching module optional
  }

  // 1. Kiểm tra cache Redis
  if (cachingService) {
    try {
      const cached = await cachingService.get({ key: PROVINCES_CACHE_KEY })
      if (cached) {
        logger?.debug?.("[GHN API] Cache HIT for provinces v3")
        return res.json(cached)
      }
    } catch (err: any) {
      logger?.warn?.(`[GHN API] Cache read error: ${err?.message}`)
    }
  }

  // 2. Fetch từ GHN API v3 (/v3/master-data/province/all)
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

    const provinces = await client.getProvincesV3()

    const responseData = {
      code: 200,
      message: "Success",
      data: provinces,
    }

    // 3. Ghi cache Redis
    if (cachingService && provinces?.length > 0) {
      cachingService
        .set({
          key: PROVINCES_CACHE_KEY,
          data: responseData,
          ttl: CACHE_TTL_SECONDS,
        })
        .catch((err) => {
          logger?.warn?.(`[GHN API] Cache write error: ${err?.message}`)
        })
    }

    return res.json(responseData)
  } catch (error: any) {
    logger?.error?.(`[GHN API] Error fetching provinces: ${error?.message}`, error)
    return res.status(500).json({
      code: 500,
      message: error?.message || "Internal server error fetching provinces",
      data: null,
    })
  }
}
