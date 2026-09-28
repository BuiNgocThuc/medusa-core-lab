import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  resolveLegacyAddress,
  mapLegacyToNew,
  GHN_PROVINCE_V3_MAP,
  GHN_DISTRICT_LIST,
} from "../../../../modules/giao-hang-nhanh/address-mapper"

/**
 * GET /store/ghn/address-mapping
 *
 * API helper tra cứu & ánh xạ hai chiều giữa:
 * 1. Địa chỉ 2 cấp mới (GHN v3: 34 Tỉnh/Thành & Phường/Xã)
 * 2. Địa chỉ 3 cấp truyền thống (GHN v1/v2: Tỉnh -> Quận/Huyện -> Phường/Xã)
 *
 * Query Params hỗ trợ:
 * - province_id: ID tỉnh v3 (vd: 1000000 cho Hà Nội, 1000013 cho An Giang)
 * - province_name: Tên tỉnh (vd: "Hà Nội", "An Giang")
 * - ward_id: ID phường v3
 * - ward_name: Tên phường v3
 * - district_name: Tên quận/huyện
 * - city: Tên thành phố/quận
 * - district_id: (Reverse lookup) Tra cứu tỉnh mới từ mã quận huyện cũ
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.query as Record<string, string | undefined>

  // 1. Tra cứu ngược (Reverse lookup: district_id -> Tỉnh v3)
  if (query.district_id) {
    const districtId = Number(query.district_id)
    const reversed = mapLegacyToNew(districtId)
    if (!reversed) {
      return res.status(404).json({
        code: 404,
        message: `Không tìm thấy Tỉnh/Thành phố v3 tương ứng với district_id: ${districtId}`,
        data: null,
      })
    }
    return res.json({
      code: 200,
      message: "Success",
      data: reversed,
    })
  }

  // 2. Tra cứu xuôi (2 cấp mới / Tên -> district_id & ward_code cũ)
  const mapped = resolveLegacyAddress({
    provinceId: query.province_id,
    provinceName: query.province_name || query.province,
    province: query.province,
    districtId: query.district_id,
    districtName: query.district_name || query.district,
    wardId: query.ward_id,
    wardName: query.ward_name || query.ward || query.city,
    wardCode: query.ward_code,
    city: query.city,
    address1: query.address_1 || query.address1,
  })

  if (!mapped) {
    return res.status(404).json({
      code: 404,
      message: "Không thể nhận diện Tỉnh / Thành phố từ thông tin đã cung cấp.",
      data: null,
    })
  }

  return res.json({
    code: 200,
    message: "Success",
    data: mapped,
  })
}
