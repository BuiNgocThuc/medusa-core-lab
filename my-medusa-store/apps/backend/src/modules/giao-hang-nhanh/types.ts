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

  // Cấu hình thông tin người gửi mặc định (nếu muốn ghi đè thông tin hồ sơ Shop tại GHN)
  fromName?: string
  fromPhone?: string
  fromHotline?: string
  fromAddress?: string
  fromWardName?: string
  fromDistrictName?: string
  fromProvinceName?: string
  isNewFromAddress?: boolean

  // Cấu hình thông tin trả hàng mặc định
  returnName?: string
  returnPhone?: string
  returnAddress?: string
  returnWardName?: string
  returnDistrictName?: string
  returnProvinceName?: string
  isNewReturnAddress?: boolean

  /**
   * Mức khai giá bảo hiểm tối đa (VND) gửi sang GHN.
   * GHN đền bù tối đa 5.000.000₫ đối với tài khoản thường không ký hợp đồng bảo hiểm giá trị cao.
   * Nếu có hợp đồng riêng với GHN, có thể cấu hình lên đến 50.000.000₫.
   * Mặc định: 5.000.000₫
   */
  maxInsuranceValue?: number
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

/**
 * Chi tiết từng sản phẩm trong đơn hàng GHN
 * Tài liệu chính thức: https://developer.ghn.dev/vi/docs/order/create#cau-truc-items
 */
export interface GhnOrderItem {
  /**
   * Tên sản phẩm. Tối đa 512 ký tự.
   * [Bắt buộc]
   */
  name: string

  /**
   * Mã sản phẩm. Mặc định: không có.
   * [Tùy chọn]
   */
  code?: string

  /**
   * Số lượng. Tối thiểu là 1.
   * [Bắt buộc]
   */
  quantity: number

  /**
   * Giá sản phẩm (VND). Mặc định: không có.
   * [Tùy chọn]
   */
  price?: number

  /**
   * Chiều dài (cm). Bắt buộc khi service_type_id = 5.
   * [Tùy chọn khi service_type_id = 2]
   */
  length?: number

  /**
   * Chiều rộng (cm). Bắt buộc khi service_type_id = 5.
   * [Tùy chọn khi service_type_id = 2]
   */
  width?: number

  /**
   * Chiều cao (cm). Bắt buộc khi service_type_id = 5.
   * [Tùy chọn khi service_type_id = 2]
   */
  height?: number

  /**
   * Khối lượng (gram). Bắt buộc khi service_type_id = 5.
   * [Tùy chọn khi service_type_id = 2]
   */
  weight?: number

  /**
   * Phân loại danh mục sản phẩm (tùy chọn)
   */
  category?: {
    level1?: string
  }
}

/**
 * Tham số tạo đơn hàng vận chuyển qua GHN API
 * Endpoint: POST https://online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/create
 * Tài liệu chính thức: https://developer.ghn.dev/vi/docs/order/create#tham-so
 */
export interface GhnCreateOrderRequest {
  // ==========================================
  // KHỐI THÔNG TIN NGƯỜI NHẬN (TO)
  // ==========================================

  /**
   * Tên người nhận. Tối đa 1024 ký tự.
   * [Bắt buộc]
   */
  to_name: string

  /**
   * Số điện thoại người nhận.
   * [Bắt buộc]
   */
  to_phone: string

  /**
   * Địa chỉ đầy đủ người nhận. Tối đa 1024 ký tự.
   * [Bắt buộc]
   */
  to_address: string

  /**
   * Tên phường/xã người nhận — hệ mới 2 cấp tra bằng Lấy Phường/Xã (Mới), hệ cũ tra bằng Lấy Phường/Xã (theo district_id).
   * [Bắt buộc]
   */
  to_ward_name: string

  /**
   * Tên quận/huyện người nhận.
   * Bắt buộc khi is_new_to_address = false; để trống/không gửi khi true (đơn vị hành chính mới không còn cấp quận/huyện).
   * Tra danh sách bằng Lấy Quận/Huyện.
   * [Tùy chọn / Bắt buộc khi is_new_to_address = false]
   */
  to_district_name?: string

  /**
   * Tên tỉnh/thành phố người nhận — hệ mới 2 cấp tra bằng Lấy Tỉnh/Thành (Mới), hệ cũ tra bằng Lấy Tỉnh/Thành.
   * [Bắt buộc]
   */
  to_province_name: string

  /**
   * Cho biết khối địa chỉ người nhận dùng hệ đơn vị hành chính nào:
   * - false (mặc định): đơn vị cũ (phường/xã + quận/huyện + tỉnh)
   * - true: đơn vị mới (phường/xã + tỉnh) sau 01/07/2025
   * [Tùy chọn]
   */
  is_new_to_address?: boolean

  // ==========================================
  // KHỐI THÔNG TIN NGƯỜI GỬI (FROM)
  // Mặc định: theo hồ sơ shop của ShopId
  // ==========================================

  /**
   * Tên người gửi. Mặc định: theo hồ sơ shop của ShopId. Tối đa 1024 ký tự.
   * [Tùy chọn]
   */
  from_name?: string

  /**
   * SĐT người gửi. Mặc định: theo hồ sơ shop.
   * [Tùy chọn]
   */
  from_phone?: string

  /**
   * Hotline người gửi. Mặc định: không có.
   * [Tùy chọn]
   */
  from_hotline?: string

  /**
   * Địa chỉ đầy đủ người gửi. Mặc định: địa chỉ shop. Tối đa 1024 ký tự.
   * [Tùy chọn]
   */
  from_address?: string

  /**
   * Tên phường/xã người gửi. Mặc định: địa chỉ shop.
   * [Tùy chọn]
   */
  from_ward_name?: string

  /**
   * Tên quận/huyện người gửi. Mặc định: địa chỉ shop.
   * [Tùy chọn]
   */
  from_district_name?: string

  /**
   * Tên tỉnh/thành người gửi. Mặc định: địa chỉ shop.
   * [Tùy chọn]
   */
  from_province_name?: string

  /**
   * Cùng quy tắc như is_new_to_address, áp dụng cho khối địa chỉ người gửi. Mặc định: false.
   * [Tùy chọn]
   */
  is_new_from_address?: boolean

  // ==========================================
  // KHỐI THÔNG TIN TRẢ HÀNG (RETURN)
  // ==========================================

  /**
   * Tên người nhận hàng trả. Mặc định: người gửi. Tối đa 1024 ký tự.
   * [Tùy chọn]
   */
  return_name?: string

  /**
   * SĐT liên hệ trả hàng. Mặc định: SĐT người gửi.
   * [Tùy chọn]
   */
  return_phone?: string

  /**
   * Địa chỉ đầy đủ trả hàng. Mặc định: địa chỉ kho mặc định của shop (trên Dashboard). Tối đa 1024 ký tự.
   * [Tùy chọn]
   */
  return_address?: string

  /**
   * Tên phường/xã trả hàng.
   * [Tùy chọn]
   */
  return_ward_name?: string

  /**
   * Tên quận/huyện trả hàng (xem is_new_to_address).
   * [Tùy chọn]
   */
  return_district_name?: string

  /**
   * Tên tỉnh/thành trả hàng.
   * [Tùy chọn]
   */
  return_province_name?: string

  /**
   * Cùng quy tắc như is_new_to_address, áp dụng cho khối địa chỉ trả hàng. Mặc định: false.
   * [Tùy chọn]
   */
  is_new_return_address?: boolean

  // ==========================================
  // KHỐI CẤU HÌNH GÓI HÀNG & DỊCH VỤ
  // ==========================================

  /**
   * Mã đơn nội bộ của shop (duy nhất theo shop). Tối đa 50 ký tự. Mặc định: null.
   * Giúp gọi lại an toàn: gửi lại request với mã đã dùng sẽ trả về order_code đã tạo trước đó thay vì tạo đơn trùng.
   * [Tùy chọn]
   */
  client_order_code?: string

  /**
   * Khối lượng (gram). Tối đa: 50,000.
   * [Bắt buộc]
   */
  weight: number

  /**
   * Chiều dài (cm). Tối đa: 200.
   * [Bắt buộc]
   */
  length: number

  /**
   * Chiều rộng (cm). Tối đa: 200.
   * [Bắt buộc]
   */
  width: number

  /**
   * Chiều cao (cm). Tối đa: 200.
   * [Bắt buộc]
   */
  height: number

  /**
   * Mô tả hàng hóa. Tối đa 2000 ký tự.
   * Bắt buộc khi không gửi items[] — thiếu cả content lẫn items sẽ bị từ chối.
   * Khi có items[], GHN tự sinh nội dung từ tên/số lượng sản phẩm.
   * [Tùy chọn]
   */
  content?: string

  /**
   * Loại dịch vụ, chọn theo khối lượng:
   * - 2: tổng khối lượng dưới 20 kg
   * - 5: tổng khối lượng từ 20 kg trở lên, hoặc đơn nhiều kiện
   * [Bắt buộc]
   */
  service_type_id: 2 | 5

  /**
   * Bên trả phí vận chuyển:
   * - 1: Shop/Người bán
   * - 2: Người mua/Người nhận
   * [Bắt buộc]
   */
  payment_type_id: 1 | 2

  /**
   * Mã khuyến mãi. Mặc định: không có.
   * [Tùy chọn]
   */
  coupon?: string | null

  /**
   * Số tiền thu hộ (COD) từ người nhận (VND). Tối đa: 50,000,000. Mặc định: 0.
   * [Tùy chọn]
   */
  cod_amount?: number

  /**
   * Số tiền thu từ người nhận khi giao thất bại (VND). Mặc định: 0.
   * [Tùy chọn]
   */
  cod_failed_amount?: number

  /**
   * Giá trị khai giá bảo hiểm (VND). Tối đa: 5,000,000. Mặc định: 0.
   * [Tùy chọn]
   */
  insurance_value?: number

  /**
   * Giá trị đơn hàng (VND). Mặc định: 0.
   * [Tùy chọn]
   */
  order_value?: number

  /**
   * Ghi chú giao hàng — một trong các giá trị:
   * - KHONGCHOXEMHANG: người nhận KHÔNG được mở/xem hàng
   * - CHOXEMHANGKHONGTHU: người nhận được xem hàng nhưng không được thử
   * - CHOTHUHANG: người nhận được xem và thử hàng
   * [Bắt buộc]
   */
  required_note: "KHONGCHOXEMHANG" | "CHOXEMHANGKHONGTHU" | "CHOTHUHANG"

  /**
   * Ghi chú cho tài xế. Tối đa 5000 ký tự. Mặc định: không có.
   * [Tùy chọn]
   */
  note?: string

  /**
   * Mã bưu cục shop mang hàng đến gửi, lấy từ Lấy Bưu cục (trường locationId).
   * Mặc định: 0 → GHN đến lấy hàng tại địa chỉ shop.
   * [Tùy chọn]
   */
  pick_station_id?: number

  /**
   * Danh sách mã ca lấy hàng (dùng Ca lấy hàng). Mặc định: ca sớm nhất.
   * [Tùy chọn]
   */
  pick_shift?: number[]

  /**
   * Danh sách sản phẩm.
   * Bắt buộc khi service_type_id = 5 (dùng để tính phí theo từng kiện) và khi không gửi content.
   * Với service_type_id = 2 thì không bắt buộc nhưng nên có.
   * [Tùy chọn]
   */
  items?: GhnOrderItem[]

  // ==========================================
  // CÁC TRƯỜNG TƯƠNG THÍCH NGƯỢC (LEGACY)
  // Không nằm trong bảng tham số chính thức của GHN v2 docs mới nhất
  // ==========================================
  /** @deprecated Không nằm trong bảng tham số docs mới */
  to_district_id?: number
  /** @deprecated Không nằm trong bảng tham số docs mới */
  to_ward_code?: string
  /** @deprecated Không nằm trong bảng tham số docs mới */
  to_province_id?: number
  /** @deprecated Không nằm trong bảng tham số docs mới */
  service_id?: number
}

export interface GhnCreateOrderFeeDetail {
  /** Phí dịch vụ giao hàng chính (VND) */
  main_service: number
  /** Phí bảo hiểm hàng hóa (VND) */
  insurance?: number
  /** Phí thu hộ COD (VND) */
  cod_fee?: number
  /** Phí gửi tại bưu cục (VND) */
  station_do?: number
  /** Phí nhận tại bưu cục (VND) */
  station_pu?: number
  /** Phí chuyển hoàn (VND) */
  return?: number
  /** Phí trả hàng về người gửi (VND) */
  r2s?: number
  /** Phí chuyển hoàn lần nữa (VND) */
  return_again?: number
  /** Giảm giá coupon (VND, số âm hoặc 0) */
  coupon?: number
  /** Phí chuyển phát chứng từ (VND) */
  document_return?: number
  /** Phí đồng kiểm (VND) */
  double_check?: number
  /** Phí đồng kiểm khi giao (VND) */
  double_check_deliver?: number
  /** Phí lấy hàng vùng xa (VND) */
  pick_remote_areas_fee?: number
  /** Phí giao hàng vùng xa (VND) */
  deliver_remote_areas_fee?: number
  /** Phí hoàn hàng vùng xa khi lấy (VND) */
  pick_remote_areas_fee_return?: number
  /** Phí hoàn hàng vùng xa khi giao (VND) */
  deliver_remote_areas_fee_return?: number
  /** Phí thu khi giao thất bại (VND) */
  cod_failed_fee?: number
  /** Phí đổi địa chỉ giao (VND) */
  change_to_address_fee?: number
  /** Phí đổi địa chỉ trả (VND) */
  change_return_address_fee?: number
  [key: string]: any
}

export interface GhnCreateOrderResponseData {
  /** Mã vận đơn GHN */
  order_code: string
  /** Chi tiết phí vận chuyển tính bởi GHN */
  fee: GhnCreateOrderFeeDetail
  /** Tổng phí vận chuyển (VND) */
  total_fee: number
  /** Thời gian giao hàng dự kiến (ISO 8601) */
  expected_delivery_time: string
  /** Mã phân loại bưu cục giao (nếu có) */
  sort_code?: string
  /** Phương thức vận chuyển (nếu có) */
  trans_type?: string
  /** Mã hóa phường/xã phân tuyến (nếu có) */
  ward_encode?: string
  /** Mã hóa quận/huyện phân tuyến (nếu có) */
  district_encode?: string
}

/**
 * Dữ liệu trả về từ API Xem trước đơn hàng (/v2/shipping-order/preview)
 * Cùng cấu trúc với GhnCreateOrderResponseData, order_code rỗng vì không tạo đơn.
 */
export type GhnPreviewOrderResponseData = GhnCreateOrderResponseData

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

/**
 * Danh sách toàn bộ mã trạng thái đơn hàng chuẩn của GHN
 * Tham chiếu chính thức: https://developer.ghn.dev - mục "Mã trạng thái đơn hàng"
 */
export enum GhnOrderStatus {
  READY_TO_PICK = "ready_to_pick",
  PICKING = "picking",
  PICKED = "picked",
  STORING = "storing",
  TRANSPORTING = "transporting",
  SORTING = "sorting",
  DELIVERING = "delivering",
  MONEY_COLLECT_DELIVERING = "money_collect_delivering",
  DELIVERED = "delivered",
  DELIVERY_FAIL = "delivery_fail",
  WAITING_TO_RETURN = "waiting_to_return",
  RETURN = "return",
  RETURN_TRANSPORTING = "return_transporting",
  RETURN_SORTING = "return_sorting",
  RETURNING = "returning",
  RETURN_FAIL = "return_fail",
  RETURNED = "returned",
  CANCEL = "cancel",
  EXCEPTION = "exception",
  DAMAGE = "damage",
  LOST = "lost",
  SCRAP = "scrap",
}

/**
 * Trạng thái kết thúc (Terminal States) theo chuẩn GHN:
 * Khi đơn đạt các trạng thái này, quy trình vận chuyển đã kết thúc vĩnh viễn,
 * sự kiện đến sau không được ghi đè lùi lại trạng thái chính.
 */
export const GHN_TERMINAL_STATUSES = new Set<string>([
  GhnOrderStatus.DELIVERED,
  GhnOrderStatus.RETURNED,
  GhnOrderStatus.CANCEL,
  GhnOrderStatus.EXCEPTION,
  GhnOrderStatus.LOST,
  GhnOrderStatus.DAMAGE,
  GhnOrderStatus.SCRAP,
])

/**
 * Trạng thái biểu thị kiện hàng đã xuất kho hoặc đang trên đường vận chuyển
 */
export const GHN_IN_TRANSIT_STATUSES = new Set<string>([
  GhnOrderStatus.PICKING,
  GhnOrderStatus.PICKED,
  GhnOrderStatus.STORING,
  GhnOrderStatus.TRANSPORTING,
  GhnOrderStatus.SORTING,
  GhnOrderStatus.DELIVERING,
  GhnOrderStatus.MONEY_COLLECT_DELIVERING,
  GhnOrderStatus.DELIVERY_FAIL,
  GhnOrderStatus.WAITING_TO_RETURN,
  GhnOrderStatus.RETURN,
  GhnOrderStatus.RETURN_TRANSPORTING,
  GhnOrderStatus.RETURN_SORTING,
  GhnOrderStatus.RETURNING,
  GhnOrderStatus.RETURN_FAIL,
])

export interface FulfillmentLifecycleResult {
  normalizedStatus: string
  isShipped: boolean
  isDelivered: boolean
  isCanceled: boolean
  isTerminal: boolean
  eventTime: Date
}

/**
 * Phân tích và chuẩn hóa vòng đời đơn hàng GHN sang Medusa Fulfillment lifecycle
 */
export function resolveFulfillmentLifecycle(
  status?: string,
  eventTimeInput?: string | Date
): FulfillmentLifecycleResult {
  const normalizedStatus = String(status || "").trim().toLowerCase()
  const isDelivered = normalizedStatus === GhnOrderStatus.DELIVERED
  const isShipped = isDelivered || GHN_IN_TRANSIT_STATUSES.has(normalizedStatus)
  const isCanceled = normalizedStatus === GhnOrderStatus.CANCEL
  const isTerminal = GHN_TERMINAL_STATUSES.has(normalizedStatus)

  let eventTime: Date
  if (eventTimeInput instanceof Date && !isNaN(eventTimeInput.getTime())) {
    eventTime = eventTimeInput
  } else if (eventTimeInput) {
    const parsed = new Date(eventTimeInput)
    eventTime = isNaN(parsed.getTime()) ? new Date() : parsed
  } else {
    eventTime = new Date()
  }

  return {
    normalizedStatus,
    isShipped,
    isDelivered,
    isCanceled,
    isTerminal,
    eventTime,
  }
}
