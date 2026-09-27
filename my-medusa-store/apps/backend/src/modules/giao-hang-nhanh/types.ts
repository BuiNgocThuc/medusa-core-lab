/**
 * Types & Interfaces cho Giao Hàng Nhanh (GHN) Fulfillment Provider
 */

export interface GhnModuleOptions {
  /**
   * API Token từ GHN Portal
   */
  token: string

  /**
   * Shop ID tại GHN (bắt buộc đối với các API tính phí và tạo đơn)
   */
  shopId: number

  /**
   * ID Quận/Huyện của kho gửi hàng (Stock Location)
   */
  fromDistrictId?: number

  /**
   * Mã Phường/Xã của kho gửi hàng
   */
  fromWardCode?: string

  /**
   * Endpoint API của GHN (Sandbox hoặc Production)
   * Mặc định: https://dev-online-gateway.ghn.vn/shiip/public-api
   */
  endpoint?: string

  /**
   * Ghi chú khi giao hàng (mặc định: CHOXEMHANGKHONGTHU)
   * Các giá trị: CHOTHUHANG, CHOXEMHANGKHONGTHU, KHONGCHOXEMHANG
   */
  requiredNote?: "CHOTHUHANG" | "CHOXEMHANGKHONGTHU" | "KHONGCHOXEMHANG"

  /**
   * Hình thức thanh toán cước:
   * 1: Người gửi trả (Shop trả cước)
   * 2: Người nhận trả
   * Mặc định: 1
   */
  paymentTypeId?: 1 | 2

  /**
   * Cân nặng mặc định của gói hàng nếu item không có weight (đơn vị: gram)
   * Mặc định: 500g
   */
  defaultWeight?: number

  /**
   * Kích thước mặc định (cm): length, width, height
   */
  defaultDimensions?: {
    length: number
    width: number
    height: number
  }

  /**
   * Chế độ mock cho môi trường local/test nếu chưa có key GHN thực tế
   */
  mockEnabled?: boolean

  /**
   * Bật định dạng địa chỉ mới (áp dụng sau 01/07/2025 với is_new_to_address: true)
   * Cho phép tạo đơn bằng to_address, to_ward_name, to_province_name mà không cần to_district_id / to_ward_code.
   * Mặc định: auto (tự động bật nếu đơn không có mã district/ward)
   */
  useNewAddressFormat?: boolean
}

export interface GhnApiResponse<T = any> {
  code: number
  message: string
  data: T
}

/**
 * Gói dịch vụ vận chuyển khả dụng trả về từ GHN API (/v2/shipping-order/available-services)
 * Đây là GHN Runtime Data — phụ thuộc vào from_district + to_district + shop_id.
 * Tách biệt hoàn toàn với Medusa Configuration (ghn-delivery).
 *
 * service_type_id:
 *   2 = Hàng nhẹ / Standard (< 20kg)
 *   5 = Hàng nặng / Heavy (≥ 20kg hoặc nhiều kiện)
 *   ...
 */
export interface GhnAvailableService {
  service_id: number
  short_name: string
  service_type_id: number
}

/**
 * Tham số tính phí vận chuyển từ GHN API (/v2/shipping-order/fee)
 *
 * Business Rules theo tài liệu GHN Developer:
 * - service_type_id = 2 (Gói Chuẩn / Hàng nhẹ < 20kg):
 *   Chỉ cần kích thước ở cấp đơn hàng (root: weight, length, width, height).
 * - service_type_id = 5 (Hàng nặng ≥ 20kg hoặc đơn nhiều kiện):
 *   BẮT BUỘC phải truyền mảng `items[]`. Hệ thống GHN sẽ tính phí theo từng kiện từ items[],
 *   mỗi item bắt buộc có đầy đủ length, width, height, weight, name, quantity.
 */
export interface GhnFeeRequest {
  from_district_id?: number
  from_ward_code?: string
  service_id?: number
  service_type_id?: number
  to_district_id?: number
  to_ward_code?: string
  to_ward_name?: string
  to_province_name?: string
  is_new_to_address?: boolean
  height?: number
  length?: number
  width?: number
  weight: number
  insurance_value?: number
  coupon?: string | null
  /**
   * Bắt buộc khi service_type_id = 5 (hàng nặng >= 20kg hoặc nhiều kiện).
   * GHN tính phí chi tiết theo từng kiện từ mảng này.
   */
  items?: GhnOrderItem[]
}

export interface GhnFeeResponseData {
  total: number
  service_fee: number
  insurance_fee: number
  pick_station_fee: number
  coupon_value: number
  r2s_fee: number
  document_return: number
  double_check: number
  cod_fee: number
  pick_remote_areas_fee: number
  deliver_remote_areas_fee: number
  cod_failed_fee: number
}

export interface GhnOrderItem {
  name: string
  code?: string
  quantity: number
  price?: number
  length?: number
  width?: number
  height?: number
  weight?: number
  category?: {
    level1?: string
  }
}

export interface GhnCreateOrderRequest {
  payment_type_id: 1 | 2
  note?: string
  required_note: "CHOTHUHANG" | "CHOXEMHANGKHONGTHU" | "KHONGCHOXEMHANG"
  from_name?: string
  from_phone?: string
  from_address?: string
  from_ward_name?: string
  from_district_name?: string
  from_province_name?: string
  return_phone?: string
  return_address?: string
  return_district_id?: number | null
  return_ward_code?: string
  client_order_code?: string
  to_name: string
  to_phone: string
  to_address: string
  /**
   * Định dạng mới (sau 01/07/2025): Bật is_new_to_address: true
   * Cho phép không truyền to_district_id và to_ward_code.
   */
  is_new_to_address?: boolean
  to_ward_name?: string
  to_province_name?: string
  to_province_id?: number
  to_district_id?: number
  to_ward_code?: string
  cod_amount?: number
  content?: string
  weight: number
  length?: number
  width?: number
  height?: number
  pick_station_id?: number
  deliver_station_id?: number | null
  insurance_value?: number
  service_id?: number
  service_type_id?: number
  coupon?: string | null
  pick_shift?: number[]
  items: GhnOrderItem[]
}

export interface GhnCreateOrderResponseData {
  order_code: string
  sort_code: string
  trans_type: string
  ward_encode: string
  district_encode: string
  fee: {
    main_service: number
    insurance: number
    station_do: number
    station_pu: number
    return: number
    r2s: number
    coupon: number
    cod_failed_fee: number
  }
  total_fee: number
  expected_delivery_time: string
}

export interface GhnCancelOrderRequest {
  order_codes: string[]
}

export interface GhnCancelOrderResponseData {
  order_code: string
  result: boolean
  message: string
}

export interface GhnProvince {
  ProvinceID: number
  ProvinceName: string
  Code: string
}

export interface GhnDistrict {
  DistrictID: number
  ProvinceID: number
  DistrictName: string
  Code: string
  Type: number
  SupportType: number
}

export interface GhnWard {
  WardCode: string
  DistrictID: number
  WardName: string
}

/**
 * Mô hình Tỉnh/Thành phố mới nhất của GHN (v3 - 34 Tỉnh/Thành phố)
 * Endpoint: GET /v3/master-data/province/all
 * Có trường extension_names chứa các biến thể (không dấu, viết tắt, tiền tố...) dùng để autocomplete / gợi ý.
 */
export interface GhnProvinceV3 {
  _id: number
  name: string
  extension_names: string[]
  type: string
  parent_id: number
  status: number
}

/**
 * Mô hình Phường/Xã mới nhất của GHN (v3)
 * Endpoint: GET /v3/master-data/ward/all-by-province-id?province_id={province_id}
 * Có trường extension_names chứa các biến thể dùng để autocomplete / gợi ý.
 */
export interface GhnWardV3 {
  _id: number
  name: string
  extension_names: string[]
  type: string
  parent_id: number
  status: number
}
