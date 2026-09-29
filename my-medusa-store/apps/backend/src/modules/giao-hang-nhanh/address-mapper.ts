/**
 * GHN Address Mapper & Helper
 *
 * Cung cấp giải pháp ánh xạ hai chiều giữa:
 * 1. Mô hình hành chính 2 cấp mới (GHN v3: 34 Tỉnh/Thành phố & Phường/Xã)
 *    - https://developer.ghn.dev/vi/docs/master-data/get-province-new
 *    - https://developer.ghn.dev/vi/docs/master-data/get-ward-new
 * 2. Mô hình hành chính 3 cấp truyền thống (GHN v1/v2: Tỉnh -> Quận/Huyện -> Phường/Xã)
 *    - https://developer.ghn.dev/vi/docs/master-data/get-province
 *    - https://developer.ghn.dev/vi/docs/master-data/get-district
 *    - https://developer.ghn.dev/vi/docs/master-data/get-ward
 *
 * Mục đích:
 * - Cho phép Storefront dùng mô hình 2 cấp hiện đại (34 Tỉnh/Thành)
 * - Tự động ánh xạ ra to_district_id và to_ward_code chuẩn cho các API GHN v2
 *   như tính cước (/v2/shipping-order/fee) và lấy dịch vụ (/v2/shipping-order/available-services)
 * - Xóa bỏ hoàn toàn việc fallback sai về Quận 1 (1442) gây đồng giá 42.900đ.
 */

export interface GhnProvinceMapping {
  v3_id: number
  v3_name: string
  legacy_province_id: number
  legacy_province_name: string
  default_district_id: number
  default_district_name: string
  default_ward_code: string
  default_ward_name: string
  aliases: string[]
}

export interface GhnDistrictMapping {
  district_id: number
  district_name: string
  province_id: number
  v3_province_id: number
  code?: string
  name_extensions?: string[]
}

export interface LegacyAddressResult {
  provinceId: number
  provinceName: string
  districtId: number
  districtName: string
  wardCode: string
  wardName: string
  matchedBy: "exact_district" | "district_in_ward" | "province_default" | "direct_input"
  v3ProvinceId?: number
  v3ProvinceName?: string
}

export interface NewAddressResult {
  provinceId: number
  provinceName: string
}

export interface AddressResolutionInput {
  provinceId?: number | string
  provinceName?: string
  province?: string
  districtId?: number | string
  districtName?: string
  district?: string
  wardId?: number | string
  wardCode?: string
  wardName?: string
  ward?: string
  city?: string
  address1?: string
}

export function removeVietnameseTones(str: string): string {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
}

// Bảng ánh xạ 34 Tỉnh / Thành phố mới (GHN v3) với Tỉnh và Quận/Huyện trung tâm (Legacy v2)
export const GHN_PROVINCE_V3_MAP: GhnProvinceMapping[] = [
  {
    "v3_id": 1000033,
    "v3_name": "Lạng Sơn",
    "legacy_province_id": 247,
    "legacy_province_name": "Lạng Sơn",
    "default_district_id": 1642,
    "default_district_name": "Thành phố Lạng Sơn",
    "default_ward_code": "100108",
    "default_ward_name": "Xã Quảng Lạc",
    "aliases": [
      "lạng sơn",
      "tỉnh lạng sơn",
      "t.lạng sơn",
      "t lạng sơn",
      "langson"
    ]
  },
  {
    "v3_id": 1000032,
    "v3_name": "Cao Bằng",
    "legacy_province_id": 246,
    "legacy_province_name": "Cao Bằng",
    "default_district_id": 1641,
    "default_district_name": "Thành phố Cao Bằng",
    "default_ward_code": "60111",
    "default_ward_name": "Xã Vĩnh Quang",
    "aliases": [
      "cao bằng",
      "tỉnh cao bằng",
      "t.cao bằng",
      "t cao bằng",
      "caobang"
    ]
  },
  {
    "v3_id": 1000031,
    "v3_name": "Nghệ An",
    "legacy_province_id": 235,
    "legacy_province_name": "Nghệ An",
    "default_district_id": 1617,
    "default_district_name": "Thành phố Vinh",
    "default_ward_code": "910353",
    "default_ward_name": "Xã Nghi Phong",
    "aliases": [
      "nghệ an",
      "tỉnh nghệ an",
      "t.nghệ an",
      "t nghệ an",
      "nghean"
    ]
  },
  {
    "v3_id": 1000030,
    "v3_name": "Thanh Hóa",
    "legacy_province_id": 234,
    "legacy_province_name": "Thanh Hóa",
    "default_district_id": 1712,
    "default_district_name": "Thành phố Sầm Sơn",
    "default_ward_code": "910216",
    "default_ward_name": "Xã Đại Hùng",
    "aliases": [
      "thanh hóa",
      "tỉnh thanh hóa",
      "t.thanh hóa",
      "t thanh hóa",
      "thanhhoa"
    ]
  },
  {
    "v3_id": 1000029,
    "v3_name": "Hà Tĩnh",
    "legacy_province_id": 236,
    "legacy_province_name": "Hà Tĩnh",
    "default_district_id": 1618,
    "default_district_name": "Thành phố Hà Tĩnh",
    "default_ward_code": "910362",
    "default_ward_name": "Xã Thạch Hội",
    "aliases": [
      "hà tĩnh",
      "tỉnh hà tĩnh",
      "t.hà tĩnh",
      "t hà tĩnh",
      "hatinh"
    ]
  },
  {
    "v3_id": 1000028,
    "v3_name": "Quảng Ninh",
    "legacy_province_id": 230,
    "legacy_province_name": "Quảng Ninh",
    "default_district_id": 1686,
    "default_district_name": "Thành phố Uông Bí",
    "default_ward_code": "170311",
    "default_ward_name": "Xã Thượng Yên Công",
    "aliases": [
      "quảng ninh",
      "tỉnh quảng ninh",
      "t.quảng ninh",
      "t quảng ninh",
      "quangninh"
    ]
  },
  {
    "v3_id": 1000027,
    "v3_name": "Sơn La",
    "legacy_province_id": 266,
    "legacy_province_name": "Sơn La",
    "default_district_id": 1677,
    "default_district_name": "Thành phố Sơn La",
    "default_ward_code": "140112",
    "default_ward_name": "Xã Hua La",
    "aliases": [
      "sơn la",
      "tỉnh sơn la",
      "t.sơn la",
      "t sơn la",
      "sonla"
    ]
  },
  {
    "v3_id": 1000026,
    "v3_name": "Điện Biên",
    "legacy_province_id": 265,
    "legacy_province_name": "Điện Biên",
    "default_district_id": 1676,
    "default_district_name": "Thành phố Điện Biên Phủ",
    "default_ward_code": "800205",
    "default_ward_name": "Xã Pá Khoang",
    "aliases": [
      "điện biên",
      "tỉnh điện biên",
      "t.điện biên",
      "t điện biên",
      "dienbien"
    ]
  },
  {
    "v3_id": 1000025,
    "v3_name": "Lai Châu",
    "legacy_province_id": 264,
    "legacy_province_name": "Lai Châu",
    "default_district_id": 1675,
    "default_district_name": "Thành phố Lai Châu",
    "default_ward_code": "800251",
    "default_ward_name": "Xã Sùng Phài",
    "aliases": [
      "lai châu",
      "tỉnh lai châu",
      "t.lai châu",
      "t lai châu",
      "laichau"
    ]
  },
  {
    "v3_id": 1000024,
    "v3_name": "Lào Cai",
    "legacy_province_id": 269,
    "legacy_province_name": "Lào Cai",
    "default_district_id": 1682,
    "default_district_name": "Thành phố Lào Cai",
    "default_ward_code": "80117",
    "default_ward_name": "Xã Vạn Hoà",
    "aliases": [
      "lào cai",
      "tỉnh lào cai",
      "t.lào cai",
      "t lào cai",
      "lao cai",
      "tinh lao cai"
    ]
  },
  {
    "v3_id": 1000023,
    "v3_name": "Hưng Yên",
    "legacy_province_id": 268,
    "legacy_province_name": "Hưng Yên",
    "default_district_id": 1680,
    "default_district_name": "Thành phố Hưng Yên",
    "default_ward_code": "910138",
    "default_ward_name": "Xã Phương Nam",
    "aliases": [
      "hưng yên",
      "tỉnh hưng yên",
      "t.hưng yên",
      "t hưng yên",
      "hung yen",
      "tinh hung yen"
    ]
  },
  {
    "v3_id": 1000022,
    "v3_name": "Cà Mau",
    "legacy_province_id": 252,
    "legacy_province_name": "Cà Mau",
    "default_district_id": 1654,
    "default_district_name": "Thành phố Cà Mau",
    "default_ward_code": "610117",
    "default_ward_name": "Xã Tân Thành",
    "aliases": [
      "cà mau",
      "tỉnh cà mau",
      "t.cà mau",
      "t cà mau",
      "ca mau",
      "ca mau",
      "cà mau",
      "cà mau",
      "tinh ca mau"
    ]
  },
  {
    "v3_id": 1000021,
    "v3_name": "Bắc Ninh",
    "legacy_province_id": 249,
    "legacy_province_name": "Bắc Ninh",
    "default_district_id": 1644,
    "default_district_name": "Thành phố Bắc Ninh",
    "default_ward_code": "910074",
    "default_ward_name": "Phường Tiền Ninh Vệ",
    "aliases": [
      "bắc ninh",
      "tỉnh bắc ninh",
      "t.bắc ninh",
      "t bắc ninh",
      "bac ninh",
      "tinh bac ninh"
    ]
  },
  {
    "v3_id": 1000020,
    "v3_name": "Thái Nguyên",
    "legacy_province_id": 244,
    "legacy_province_name": "Thái Nguyên",
    "default_district_id": 1639,
    "default_district_name": "Thành phố Thái Nguyên",
    "default_ward_code": "800211",
    "default_ward_name": "Xã Sơn Cẩm",
    "aliases": [
      "thái nguyên",
      "tỉnh thái nguyên",
      "t.thái nguyên",
      "t thái nguyên",
      "thai nguyen",
      "tinh thai nguyen"
    ]
  },
  {
    "v3_id": 1000019,
    "v3_name": "Quảng Ngãi",
    "legacy_province_id": 242,
    "legacy_province_name": "Quảng Ngãi",
    "default_district_id": 1630,
    "default_district_name": "Thành phố Quảng Ngãi",
    "default_ward_code": "910341",
    "default_ward_name": "Xã An Phú",
    "aliases": [
      "quảng ngãi",
      "tỉnh quảng ngãi",
      "t.quảng ngãi",
      "t quảng ngãi",
      "quang ngai",
      "tinh quang ngai"
    ]
  },
  {
    "v3_id": 1000018,
    "v3_name": "Tây Ninh",
    "legacy_province_id": 240,
    "legacy_province_name": "Tây Ninh",
    "default_district_id": 1626,
    "default_district_name": "Thành phố Tây Ninh",
    "default_ward_code": "460110",
    "default_ward_name": "Xã Thạnh Tân",
    "aliases": [
      "tây ninh",
      "tỉnh tây ninh",
      "t.tây ninh",
      "t tây ninh",
      "tay ninh",
      "tinh tay ninh"
    ]
  },
  {
    "v3_id": 1000017,
    "v3_name": "Quảng Trị",
    "legacy_province_id": 238,
    "legacy_province_name": "Quảng Trị",
    "default_district_id": 1620,
    "default_district_name": "Thành phố Đông Hà",
    "default_ward_code": "320109",
    "default_ward_name": "Phường Đông Thanh",
    "aliases": [
      "quảng trị",
      "tỉnh quảng trị",
      "t.quảng trị",
      "t quảng trị",
      "quang tri",
      "tinh quang tri"
    ]
  },
  {
    "v3_id": 1000016,
    "v3_name": "Ninh Bình",
    "legacy_province_id": 233,
    "legacy_province_name": "Ninh Bình",
    "default_district_id": 1713,
    "default_district_name": "Thành phố Tam Điệp",
    "default_ward_code": "270209",
    "default_ward_name": "Xã Yên Sơn",
    "aliases": [
      "ninh bình",
      "tỉnh ninh bình",
      "t.ninh bình",
      "t ninh bình",
      "ninh binh",
      "tinh ninh binh"
    ]
  },
  {
    "v3_id": 1000015,
    "v3_name": "Phú Thọ",
    "legacy_province_id": 229,
    "legacy_province_name": "Phú Thọ",
    "default_district_id": 1602,
    "default_district_name": "Thành phố Việt Trì",
    "default_ward_code": "150123",
    "default_ward_name": "Xã Trưng Vương",
    "aliases": [
      "phú thọ",
      "tỉnh phú thọ",
      "t.phú thọ",
      "t phú thọ",
      "phu tho",
      "tinh phu tho"
    ]
  },
  {
    "v3_id": 1000014,
    "v3_name": "Tuyên Quang",
    "legacy_province_id": 228,
    "legacy_province_name": "Tuyên Quang",
    "default_district_id": 1601,
    "default_district_name": "Thành phố Tuyên Quang",
    "default_ward_code": "90113",
    "default_ward_name": "Xã Tràng Đà",
    "aliases": [
      "tuyên quang",
      "tỉnh tuyên quang",
      "t.tuyên quang",
      "t tuyên quang",
      "tuyen quang",
      "tinh tuyen quang"
    ]
  },
  {
    "v3_id": 1000013,
    "v3_name": "An Giang",
    "legacy_province_id": 217,
    "legacy_province_name": "An Giang",
    "default_district_id": 1753,
    "default_district_name": "Thành phố Châu Đốc",
    "default_ward_code": "510207",
    "default_ward_name": "Xã Vĩnh Châu",
    "aliases": [
      "an giang",
      "tỉnh an giang",
      "t.an giang",
      "t an giang",
      "tinh an giang"
    ]
  },
  {
    "v3_id": 1000012,
    "v3_name": "Đồng Tháp",
    "legacy_province_id": 216,
    "legacy_province_name": "Đồng Tháp",
    "default_district_id": 1668,
    "default_district_name": "Thành phố Sa Đéc",
    "default_ward_code": "500209",
    "default_ward_name": "Xã Tân Quy Tây",
    "aliases": [
      "đồng tháp",
      "tỉnh đồng tháp",
      "t.đồng tháp",
      "t đồng tháp",
      "dong thap",
      "tinh dong thap"
    ]
  },
  {
    "v3_id": 1000011,
    "v3_name": "Vĩnh Long",
    "legacy_province_id": 215,
    "legacy_province_name": "Vĩnh Long",
    "default_district_id": 1562,
    "default_district_name": "Thành phố Vĩnh Long",
    "default_ward_code": "570111",
    "default_ward_name": "Xã Trường An",
    "aliases": [
      "vĩnh long",
      "tỉnh vĩnh long",
      "t.vĩnh long",
      "t vĩnh long",
      "vinh long",
      "tinh vinh long"
    ]
  },
  {
    "v3_id": 1000010,
    "v3_name": "Đắk Lắk",
    "legacy_province_id": 210,
    "legacy_province_name": "Đắk Lắk",
    "default_district_id": 1552,
    "default_district_name": "Thành phố Buôn Ma Thuột",
    "default_ward_code": "400121",
    "default_ward_name": "Xã Hòa Xuân",
    "aliases": [
      "đắk lắk",
      "tỉnh đắk lắk",
      "t.đắk lắk",
      "t đắk lắk",
      "dak lak",
      "tinh dak lak",
      "daklak",
      "daklak",
      "tinh daklak",
      "tinh daklak"
    ]
  },
  {
    "v3_id": 1000009,
    "v3_name": "Lâm Đồng",
    "legacy_province_id": 209,
    "legacy_province_name": "Lâm Đồng",
    "default_district_id": 1838,
    "default_district_name": "Thành phố Bảo Lộc",
    "default_ward_code": "420211",
    "default_ward_name": "Xã Lộc Thanh",
    "aliases": [
      "lâm đồng",
      "tỉnh lâm đồng",
      "t.lâm đồng",
      "t lâm đồng",
      "lam dong",
      "tinh lam dong"
    ]
  },
  {
    "v3_id": 1000008,
    "v3_name": "Khánh Hòa",
    "legacy_province_id": 208,
    "legacy_province_name": "Khánh Hòa",
    "default_district_id": 1664,
    "default_district_name": "Thành phố Cam Ranh",
    "default_ward_code": "410615",
    "default_ward_name": "Xã Cam Thịnh Tây",
    "aliases": [
      "khánh hòa",
      "tỉnh khánh hòa",
      "t.khánh hòa",
      "t khánh hòa",
      "khanh hoa",
      "tinh khanh hoa"
    ]
  },
  {
    "v3_id": 1000007,
    "v3_name": "Gia Lai",
    "legacy_province_id": 207,
    "legacy_province_name": "Gia Lai",
    "default_district_id": 1546,
    "default_district_name": "Thành phố Pleiku",
    "default_ward_code": "380123",
    "default_ward_name": "Xã Trà Đa",
    "aliases": [
      "gia lai",
      "tỉnh gia lai",
      "t.gia lai",
      "t gia lai",
      "tinh gia lai"
    ]
  },
  {
    "v3_id": 1000006,
    "v3_name": "Đồng Nai",
    "legacy_province_id": 204,
    "legacy_province_name": "Đồng Nai",
    "default_district_id": 1692,
    "default_district_name": "Thành phố Long Khánh",
    "default_ward_code": "480615",
    "default_ward_name": "Xã Xuân Tân",
    "aliases": [
      "đồng nai",
      "tỉnh đồng nai",
      "t.đồng nai",
      "t đồng nai",
      "dong nai",
      "tinh dong nai"
    ]
  },
  {
    "v3_id": 1000005,
    "v3_name": "Cần Thơ",
    "legacy_province_id": 220,
    "legacy_province_name": "Cần Thơ",
    "default_district_id": 1572,
    "default_district_name": "Quận Ninh Kiều",
    "default_ward_code": "550113",
    "default_ward_name": "Phường Xuân Khánh",
    "aliases": [
      "cần thơ",
      "tp.cần thơ",
      "tp. cần thơ",
      "tp cần thơ",
      "thành phố cần thơ",
      "can tho",
      "thanh pho can tho"
    ]
  },
  {
    "v3_id": 1000004,
    "v3_name": "Hải Phòng",
    "legacy_province_id": 224,
    "legacy_province_name": "Hải Phòng",
    "default_district_id": 1589,
    "default_district_name": "Quận Hồng Bàng",
    "default_ward_code": "910165",
    "default_ward_name": "Phường An Hưng",
    "aliases": [
      "hải phòng",
      "tp.hải phòng",
      "tp. hải phòng",
      "tp hải phòng",
      "thành phố hải phòng",
      "hai phong",
      "thanh pho hai phong"
    ]
  },
  {
    "v3_id": 1000003,
    "v3_name": "Đà Nẵng",
    "legacy_province_id": 203,
    "legacy_province_name": "Đà Nẵng",
    "default_district_id": 1526,
    "default_district_name": "Quận Hải Châu",
    "default_ward_code": "910347",
    "default_ward_name": "Phường Hải Châu",
    "aliases": [
      "đà nẵng",
      "tp.đà nẵng",
      "tp. đà nẵng",
      "tp đà nẵng",
      "thành phố đà nẵng",
      "da nang",
      "thanh pho da nang"
    ]
  },
  {
    "v3_id": 1000002,
    "v3_name": "Huế",
    "legacy_province_id": 223,
    "legacy_province_name": "Thừa Thiên Huế",
    "default_district_id": 1585,
    "default_district_name": "Thành phố Huế",
    "default_ward_code": "90814",
    "default_ward_name": "Xã Hương Thọ",
    "aliases": [
      "thừa thiên huế",
      "thừa thiên - huế",
      "tỉnh thừa thiên - huế",
      "t.thừa thiên - huế",
      "t thừa thiên - huế",
      "hue",
      "thuathienhue",
      "tỉnh thừa thiên huế",
      "thanh pho hue",
      "thành phố huế",
      "tp huế"
    ]
  },
  {
    "v3_id": 1000001,
    "v3_name": "Hồ Chí Minh",
    "legacy_province_id": 202,
    "legacy_province_name": "Hồ Chí Minh",
    "default_district_id": 1442,
    "default_district_name": "Quận 1",
    "default_ward_code": "20110",
    "default_ward_name": "Phường Tân Định",
    "aliases": [
      "hồ chí minh",
      "tp.hồ chí minh",
      "tp. hồ chí minh",
      "tp hồ chí minh",
      "thành phố hồ chí minh",
      "hcm",
      "hcm",
      "hcm",
      "ho chi minh",
      "thanh pho ho chi minh"
    ]
  },
  {
    "v3_id": 1000000,
    "v3_name": "Hà Nội",
    "legacy_province_id": 201,
    "legacy_province_name": "Hà Nội",
    "default_district_id": 1486,
    "default_district_name": "Quận Đống Đa",
    "default_ward_code": "910012",
    "default_ward_name": "Phường Văn Miếu - Quốc Tử Giám",
    "aliases": [
      "hà nội",
      "tp.hà nội",
      "tp. hà nội",
      "tp hà nội",
      "thành phố hà nội",
      "hanoi",
      "hn",
      "ha noi"
    ]
  }
]

// Bảng danh mục 431 Quận / Huyện thuộc 34 Tỉnh / Thành phố
export const GHN_DISTRICT_LIST: GhnDistrictMapping[] = [
  {
    "district_id": 3311,
    "district_name": "Huyện Văn Quan",
    "province_id": 247,
    "v3_province_id": 1000033,
    "code": "1006",
    "name_extensions": [
      "Huyện Văn Quan",
      "H.Văn Quan",
      "H Văn Quan",
      "Văn Quan",
      "Van Quan"
    ]
  },
  {
    "district_id": 3310,
    "district_name": "Huyện Văn Lãng",
    "province_id": 247,
    "v3_province_id": 1000033,
    "code": "1004",
    "name_extensions": [
      "Huyện Văn Lãng",
      "H.Văn Lãng",
      "H Văn Lãng",
      "Văn Lãng",
      "Van Lang"
    ]
  },
  {
    "district_id": 3182,
    "district_name": "Huyện Đình Lập",
    "province_id": 247,
    "v3_province_id": 1000033,
    "code": "1010",
    "name_extensions": [
      "Huyện Đình Lập",
      "H.Đình Lập",
      "H Đình Lập",
      "Đình Lập",
      "Dinh Lap"
    ]
  },
  {
    "district_id": 3156,
    "district_name": "Huyện Chi Lăng",
    "province_id": 247,
    "v3_province_id": 1000033,
    "code": "1009",
    "name_extensions": [
      "Huyện Chi Lăng",
      "H.Chi Lăng",
      "H Chi Lăng",
      "Chi Lăng",
      "Chi Lang"
    ]
  },
  {
    "district_id": 3138,
    "district_name": "Huyện Bình Gia",
    "province_id": 247,
    "v3_province_id": 1000033,
    "code": "1003",
    "name_extensions": [
      "Huyện Bình Gia",
      "H.Bình Gia",
      "H Bình Gia",
      "Bình Gia",
      "Binh Gia"
    ]
  },
  {
    "district_id": 3134,
    "district_name": "Huyện Bắc Sơn",
    "province_id": 247,
    "v3_province_id": 1000033,
    "code": "1005",
    "name_extensions": [
      "Huyện Bắc Sơn",
      "H.Bắc Sơn",
      "H Bắc Sơn",
      "Bắc Sơn",
      "Bac Son"
    ]
  },
  {
    "district_id": 2036,
    "district_name": "Huyện Tràng Định",
    "province_id": 247,
    "v3_province_id": 1000033,
    "code": "1002",
    "name_extensions": [
      "Huyện Tràng Định",
      "H.Tràng Định",
      "H Tràng Định",
      "Tràng Định",
      "Trang Dinh"
    ]
  },
  {
    "district_id": 1963,
    "district_name": "Huyện Lộc Bình",
    "province_id": 247,
    "v3_province_id": 1000033,
    "code": "1008",
    "name_extensions": [
      "Huyện Lộc Bình",
      "H.Lộc Bình",
      "H Lộc Bình",
      "Lộc Bình",
      "Loc Binh"
    ]
  },
  {
    "district_id": 1948,
    "district_name": "Huyện Hữu Lũng",
    "province_id": 247,
    "v3_province_id": 1000033,
    "code": "1011",
    "name_extensions": [
      "Huyện Hữu Lũng",
      "H.Hữu Lũng",
      "H Hữu Lũng",
      "Hữu Lũng",
      "Huu Lung"
    ]
  },
  {
    "district_id": 1904,
    "district_name": "Huyện Cao Lộc",
    "province_id": 247,
    "v3_province_id": 1000033,
    "code": "1007",
    "name_extensions": [
      "Huyện Cao Lộc",
      "H.Cao Lộc",
      "H Cao Lộc",
      "Cao Lộc",
      "Cao Loc"
    ]
  },
  {
    "district_id": 1642,
    "district_name": "Thành phố Lạng Sơn",
    "province_id": 247,
    "v3_province_id": 1000033,
    "code": "1001",
    "name_extensions": [
      "Thành phố Lạng Sơn",
      "TP.Lạng Sơn",
      "TP Lạng Sơn",
      "Lạng Sơn",
      "Lang Son"
    ]
  },
  {
    "district_id": 3694,
    "district_name": "Huyện Quảng Hòa",
    "province_id": 246,
    "v3_province_id": 1000032,
    "code": "3694",
    "name_extensions": [
      "Huyện Quảng Hòa",
      "H.Quảng Hòa",
      "Quang Hoa",
      "Huyen Quang Hoa",
      "quanghoa"
    ]
  },
  {
    "district_id": 3305,
    "district_name": "Huyện Trà Lĩnh",
    "province_id": 246,
    "v3_province_id": 1000032,
    "code": "0605",
    "name_extensions": [
      "Huyện Trà Lĩnh",
      "H.Trà Lĩnh",
      "H Trà Lĩnh",
      "Trà Lĩnh",
      "Tra Linh"
    ]
  },
  {
    "district_id": 3299,
    "district_name": "Huyện Thông Nông",
    "province_id": 246,
    "v3_province_id": 1000032,
    "code": "0603",
    "name_extensions": [
      "Huyện Thông Nông",
      "H.Thông Nông",
      "H Thông Nông",
      "Thông Nông",
      "Thong Nong"
    ]
  },
  {
    "district_id": 3289,
    "district_name": "Huyện Thạch An",
    "province_id": 246,
    "v3_province_id": 1000032,
    "code": "0610",
    "name_extensions": [
      "Huyện Thạch An",
      "H.Thạch An",
      "H Thạch An",
      "Thạch An",
      "Thach An"
    ]
  },
  {
    "district_id": 3259,
    "district_name": "Huyện Quảng Uyên",
    "province_id": 246,
    "v3_province_id": 1000032,
    "code": "0609",
    "name_extensions": [
      "Huyện Quảng Uyên",
      "H.Quảng Uyên",
      "H Quảng Uyên",
      "Quảng Uyên",
      "Quang Uyen"
    ]
  },
  {
    "district_id": 3246,
    "district_name": "Huyện Nguyên Bình",
    "province_id": 246,
    "v3_province_id": 1000032,
    "code": "0607",
    "name_extensions": [
      "Huyện Nguyên Bình",
      "H.Nguyên Bình",
      "H Nguyên Bình",
      "Nguyên Bình",
      "Nguyen Binh"
    ]
  },
  {
    "district_id": 3194,
    "district_name": "Huyện Hạ Lang",
    "province_id": 246,
    "v3_province_id": 1000032,
    "code": "0611",
    "name_extensions": [
      "Huyện Hạ Lang",
      "H.Hạ Lang",
      "H Hạ Lang",
      "Hạ Lang",
      "Ha Lang"
    ]
  },
  {
    "district_id": 3130,
    "district_name": "Huyện Bảo Lạc",
    "province_id": 246,
    "v3_province_id": 1000032,
    "code": "0602",
    "name_extensions": [
      "Huyện Bảo Lạc",
      "H.Bảo Lạc",
      "H Bảo Lạc",
      "Bảo Lạc",
      "Bao Lac"
    ]
  },
  {
    "district_id": 2041,
    "district_name": "Huyện Trùng Khánh",
    "province_id": 246,
    "v3_province_id": 1000032,
    "code": "0606",
    "name_extensions": [
      "Huyện Trùng Khánh",
      "H.Trùng Khánh",
      "H Trùng Khánh",
      "Trùng Khánh",
      "Trung Khanh"
    ]
  },
  {
    "district_id": 1997,
    "district_name": "Huyện Phục Hòa",
    "province_id": 246,
    "v3_province_id": 1000032,
    "code": "0613",
    "name_extensions": [
      "Huyện Phục Hòa",
      "H.Phục Hòa",
      "H Phục Hòa",
      "Phục Hòa",
      "Phuc Hoa"
    ]
  },
  {
    "district_id": 1943,
    "district_name": "Huyện Hòa An",
    "province_id": 246,
    "v3_province_id": 1000032,
    "code": "0608",
    "name_extensions": [
      "Huyện Hòa An",
      "H.Hòa An",
      "H Hòa An",
      "Hòa An",
      "Hoa An"
    ]
  },
  {
    "district_id": 1939,
    "district_name": "Huyện Hà Quảng",
    "province_id": 246,
    "v3_province_id": 1000032,
    "code": "0604",
    "name_extensions": [
      "Huyện Hà Quảng",
      "H.Hà Quảng",
      "H Hà Quảng",
      "Hà Quảng",
      "Ha Quang"
    ]
  },
  {
    "district_id": 1890,
    "district_name": "Huyện Bảo Lâm",
    "province_id": 246,
    "v3_province_id": 1000032,
    "code": "0612",
    "name_extensions": [
      "Huyện Bảo Lâm",
      "H.Bảo Lâm",
      "H Bảo Lâm",
      "Bảo Lâm",
      "Bao Lam"
    ]
  },
  {
    "district_id": 1641,
    "district_name": "Thành phố Cao Bằng",
    "province_id": 246,
    "v3_province_id": 1000032,
    "code": "0601",
    "name_extensions": [
      "Thành phố Cao Bằng",
      "TP.Cao Bằng",
      "TP Cao Bằng",
      "Cao Bằng",
      "Cao Bang"
    ]
  },
  {
    "district_id": 3291,
    "district_name": "Huyện Thanh Chương",
    "province_id": 235,
    "v3_province_id": 1000031,
    "code": "2915",
    "name_extensions": [
      "Huyện Thanh Chương",
      "H.Thanh Chương",
      "H Thanh Chương",
      "Thanh Chương",
      "Thanh Chuong"
    ]
  },
  {
    "district_id": 3288,
    "district_name": "Huyện Tương Dương",
    "province_id": 235,
    "v3_province_id": 1000031,
    "code": "2908",
    "name_extensions": [
      "Huyện Tương Dương",
      "H.Tương Dương",
      "H Tương Dương",
      "Tương Dương",
      "Tuong Duong"
    ]
  },
  {
    "district_id": 3261,
    "district_name": "Huyện Quỳ Châu",
    "province_id": 235,
    "v3_province_id": 1000031,
    "code": "2903",
    "name_extensions": [
      "Huyện Quỳ Châu",
      "H.Quỳ Châu",
      "H Quỳ Châu",
      "Quỳ Châu",
      "Quy Chau"
    ]
  },
  {
    "district_id": 3260,
    "district_name": "Huyện Quế Phong",
    "province_id": 235,
    "v3_province_id": 1000031,
    "code": "2919",
    "name_extensions": [
      "Huyện Quế Phong",
      "H.Quế Phong",
      "H Quế Phong",
      "Quế Phong",
      "Que Phong"
    ]
  },
  {
    "district_id": 3233,
    "district_name": "Huyện Nam Đàn",
    "province_id": 235,
    "v3_province_id": 1000031,
    "code": "2917",
    "name_extensions": [
      "Huyện Nam Đàn",
      "H.Nam Đàn",
      "H Nam Đàn",
      "Nam Đàn",
      "Nam Dan"
    ]
  },
  {
    "district_id": 3211,
    "district_name": "Huyện Kỳ Sơn",
    "province_id": 235,
    "v3_province_id": 1000031,
    "code": "2907",
    "name_extensions": [
      "Huyện Kỳ Sơn",
      "H.Kỳ Sơn",
      "H Kỳ Sơn",
      "Kỳ Sơn",
      "Ky Son"
    ]
  },
  {
    "district_id": 1947,
    "district_name": "Huyện Hưng Nguyên",
    "province_id": 235,
    "v3_province_id": 1000031,
    "code": "2918",
    "name_extensions": [
      "Huyện Hưng Nguyên",
      "H.Hưng Nguyên",
      "H Hưng Nguyên",
      "Hưng Nguyên",
      "Hung Nguyen"
    ]
  },
  {
    "district_id": 1854,
    "district_name": "Huyện Nghi Lộc",
    "province_id": 235,
    "v3_province_id": 1000031,
    "code": "2916",
    "name_extensions": [
      "Huyện Nghi Lộc",
      "H.Nghi Lộc",
      "H Nghi Lộc",
      "Nghi Lộc",
      "Nghi Loc"
    ]
  },
  {
    "district_id": 1853,
    "district_name": "Huyện Con Cuông",
    "province_id": 235,
    "v3_province_id": 1000031,
    "code": "2909",
    "name_extensions": [
      "Huyện Con Cuông",
      "H.Con Cuông",
      "H Con Cuông",
      "Con Cuông",
      "Con Cuong"
    ]
  },
  {
    "district_id": 1852,
    "district_name": "Huyện Quỳ Hợp",
    "province_id": 235,
    "v3_province_id": 1000031,
    "code": "2904",
    "name_extensions": [
      "Huyện Quỳ Hợp",
      "H.Quỳ Hợp",
      "H Quỳ Hợp",
      "Quỳ Hợp",
      "Quy Hop"
    ]
  },
  {
    "district_id": 1851,
    "district_name": "Huyện Nghĩa Đàn",
    "province_id": 235,
    "v3_province_id": 1000031,
    "code": "2905",
    "name_extensions": [
      "Huyện Nghĩa Đàn",
      "H.Nghĩa Đàn",
      "H Nghĩa Đàn",
      "Nghĩa Đàn",
      "Nghia Dan"
    ]
  },
  {
    "district_id": 1850,
    "district_name": "Thị xã Thái Hòa",
    "province_id": 235,
    "v3_province_id": 1000031,
    "code": "2920",
    "name_extensions": [
      "Thị xã Thái Hòa",
      "TX.Thái Hòa",
      "TX Thái Hòa",
      "Thái Hòa",
      "Thai Hoa"
    ]
  },
  {
    "district_id": 1849,
    "district_name": "Thị xã Hoàng Mai",
    "province_id": 235,
    "v3_province_id": 1000031,
    "code": "2921",
    "name_extensions": [
      "Thị xã Hoàng Mai",
      "TX.Hoàng Mai",
      "TX Hoàng Mai",
      "Hoàng Mai",
      "Hoang Mai"
    ]
  },
  {
    "district_id": 1848,
    "district_name": "Huyện Quỳnh Lưu",
    "province_id": 235,
    "v3_province_id": 1000031,
    "code": "2906",
    "name_extensions": [
      "Huyện Quỳnh Lưu",
      "H.Quỳnh Lưu",
      "H Quỳnh Lưu",
      "Quỳnh Lưu",
      "Quynh Luu"
    ]
  },
  {
    "district_id": 1847,
    "district_name": "Huyện Diễn Châu",
    "province_id": 235,
    "v3_province_id": 1000031,
    "code": "2912",
    "name_extensions": [
      "Huyện Diễn Châu",
      "H.Diễn Châu",
      "H Diễn Châu",
      "Diễn Châu",
      "Dien Chau"
    ]
  },
  {
    "district_id": 1846,
    "district_name": "Huyện Yên Thành",
    "province_id": 235,
    "v3_province_id": 1000031,
    "code": "2911",
    "name_extensions": [
      "Huyện Yên Thành",
      "H.Yên Thành",
      "H Yên Thành",
      "Yên Thành",
      "Yen Thanh"
    ]
  },
  {
    "district_id": 1845,
    "district_name": "Huyện Tân Kỳ",
    "province_id": 235,
    "v3_province_id": 1000031,
    "code": "2910",
    "name_extensions": [
      "Huyện Tân Kỳ",
      "H.Tân Kỳ",
      "H Tân Kỳ",
      "Tân Kỳ",
      "Tan Ky"
    ]
  },
  {
    "district_id": 1844,
    "district_name": "Huyện Anh Sơn",
    "province_id": 235,
    "v3_province_id": 1000031,
    "code": "2913",
    "name_extensions": [
      "Huyện Anh Sơn",
      "H.Anh Sơn",
      "H Anh Sơn",
      "Anh Sơn",
      "Anh Son"
    ]
  },
  {
    "district_id": 1843,
    "district_name": "Huyện Đô Lương",
    "province_id": 235,
    "v3_province_id": 1000031,
    "code": "2914",
    "name_extensions": [
      "Huyện Đô Lương",
      "H.Đô Lương",
      "H Đô Lương",
      "Đô Lương",
      "Do Luong"
    ]
  },
  {
    "district_id": 1842,
    "district_name": "Thị xã Cửa Lò",
    "province_id": 235,
    "v3_province_id": 1000031,
    "code": "2902",
    "name_extensions": [
      "Thị xã Cửa Lò",
      "TX.Cửa Lò",
      "TX Cửa Lò",
      "Cửa Lò",
      "Cua Lo"
    ]
  },
  {
    "district_id": 1617,
    "district_name": "Thành phố Vinh",
    "province_id": 235,
    "v3_province_id": 1000031,
    "code": "2901",
    "name_extensions": [
      "Thành phố Vinh",
      "TP.Vinh",
      "TP Vinh",
      "Vinh",
      "Thanh pho Vinh"
    ]
  },
  {
    "district_id": 3298,
    "district_name": "Huyện Thiệu Hóa",
    "province_id": 234,
    "v3_province_id": 1000030,
    "code": "2817",
    "name_extensions": [
      "Huyện Thiệu Hóa",
      "H.Thiệu Hóa",
      "H Thiệu Hóa",
      "Thiệu Hóa",
      "Thieu Hoa"
    ]
  },
  {
    "district_id": 3241,
    "district_name": "Huyện Nga Sơn",
    "province_id": 234,
    "v3_province_id": 1000030,
    "code": "2823",
    "name_extensions": [
      "Huyện Nga Sơn",
      "H.Nga Sơn",
      "H Nga Sơn",
      "Nga Sơn",
      "Nga Son"
    ]
  },
  {
    "district_id": 3216,
    "district_name": "Huyện Lang Chánh",
    "province_id": 234,
    "v3_province_id": 1000030,
    "code": "2811",
    "name_extensions": [
      "Huyện Lang Chánh",
      "H.Lang Chánh",
      "H Lang Chánh",
      "Lang Chánh",
      "Lang Chanh"
    ]
  },
  {
    "district_id": 3147,
    "district_name": "Huyện Cẩm Thủy",
    "province_id": 234,
    "v3_province_id": 1000030,
    "code": "2814",
    "name_extensions": [
      "Huyện Cẩm Thủy",
      "H.Cẩm Thủy",
      "H Cẩm Thủy",
      "Cẩm Thủy",
      "Cam Thuy"
    ]
  },
  {
    "district_id": 2249,
    "district_name": "Huyện Triệu Sơn",
    "province_id": 234,
    "v3_province_id": 1000030,
    "code": "2818",
    "name_extensions": [
      "Huyện Triệu Sơn",
      "H.Triệu Sơn",
      "H Triệu Sơn",
      "Triệu Sơn",
      "Trieu Son"
    ]
  },
  {
    "district_id": 2190,
    "district_name": "Huyện Như Thanh",
    "province_id": 234,
    "v3_province_id": 1000030,
    "code": "2810",
    "name_extensions": [
      "Huyện Như Thanh",
      "H.Như Thanh",
      "H Như Thanh",
      "Như Thanh",
      "Nhu Thanh"
    ]
  },
  {
    "district_id": 2181,
    "district_name": "Huyện Nông Cống",
    "province_id": 234,
    "v3_province_id": 1000030,
    "code": "2819",
    "name_extensions": [
      "Huyện Nông Cống",
      "H.Nông Cống",
      "H Nông Cống",
      "Nông Cống",
      "Nong Cong"
    ]
  },
  {
    "district_id": 2070,
    "district_name": "Huyện Bá Thước",
    "province_id": 234,
    "v3_province_id": 1000030,
    "code": "2807",
    "name_extensions": [
      "Huyện Bá Thước",
      "H.Bá Thước",
      "H Bá Thước",
      "Bá Thước",
      "Ba Thuoc"
    ]
  },
  {
    "district_id": 2000,
    "district_name": "Huyện Quan Sơn",
    "province_id": 234,
    "v3_province_id": 1000030,
    "code": "2805",
    "name_extensions": [
      "Huyện Quan Sơn",
      "H.Quan Sơn",
      "H Quan Sơn",
      "Quan Sơn",
      "Son"
    ]
  },
  {
    "district_id": 1942,
    "district_name": "Huyện Hậu Lộc",
    "province_id": 234,
    "v3_province_id": 1000030,
    "code": "2824",
    "name_extensions": [
      "Huyện Hậu Lộc",
      "H.Hậu Lộc",
      "H Hậu Lộc",
      "Hậu Lộc",
      "Hau Loc"
    ]
  },
  {
    "district_id": 1927,
    "district_name": "Huyện Đông Sơn",
    "province_id": 234,
    "v3_province_id": 1000030,
    "code": "2820",
    "name_extensions": [
      "Huyện Đông Sơn",
      "H.Đông Sơn",
      "H Đông Sơn",
      "Đông Sơn",
      "Dong Son"
    ]
  },
  {
    "district_id": 1881,
    "district_name": "Huyện Vĩnh Lộc",
    "province_id": 234,
    "v3_province_id": 1000030,
    "code": "2816",
    "name_extensions": [
      "Huyện Vĩnh Lộc",
      "H.Vĩnh Lộc",
      "H Vĩnh Lộc",
      "Vĩnh Lộc",
      "Vinh Loc"
    ]
  },
  {
    "district_id": 1880,
    "district_name": "Huyện Thạch Thành",
    "province_id": 234,
    "v3_province_id": 1000030,
    "code": "2813",
    "name_extensions": [
      "Huyện Thạch Thành",
      "H.Thạch Thành",
      "H Thạch Thành",
      "Thạch Thành",
      "Thach Thanh"
    ]
  },
  {
    "district_id": 1879,
    "district_name": "Huyện Quan Hóa",
    "province_id": 234,
    "v3_province_id": 1000030,
    "code": "2804",
    "name_extensions": [
      "Huyện Quan Hóa",
      "H.Quan Hóa",
      "H Quan Hóa",
      "Quan Hóa",
      "Hoa"
    ]
  },
  {
    "district_id": 1878,
    "district_name": "Huyện Mường Lát",
    "province_id": 234,
    "v3_province_id": 1000030,
    "code": "2806",
    "name_extensions": [
      "Huyện Mường Lát",
      "H.Mường Lát",
      "H Mường Lát",
      "Mường Lát",
      "Muong Lat"
    ]
  },
  {
    "district_id": 1877,
    "district_name": "Huyện Hà Trung",
    "province_id": 234,
    "v3_province_id": 1000030,
    "code": "2821",
    "name_extensions": [
      "Huyện Hà Trung",
      "H.Hà Trung",
      "H Hà Trung",
      "Hà Trung",
      "Ha Trung"
    ]
  },
  {
    "district_id": 1876,
    "district_name": "Thị xã Bỉm Sơn",
    "province_id": 234,
    "v3_province_id": 1000030,
    "code": "2802",
    "name_extensions": [
      "Thị xã Bỉm Sơn",
      "TX.Bỉm Sơn",
      "TX Bỉm Sơn",
      "Bỉm Sơn",
      "Bim Son"
    ]
  },
  {
    "district_id": 1875,
    "district_name": "Huyện Yên Định",
    "province_id": 234,
    "v3_province_id": 1000030,
    "code": "2827",
    "name_extensions": [
      "Huyện Yên Định",
      "H.Yên Định",
      "H Yên Định",
      "Yên Định",
      "Yen Dinh"
    ]
  },
  {
    "district_id": 1874,
    "district_name": "Huyện Ngọc Lặc",
    "province_id": 234,
    "v3_province_id": 1000030,
    "code": "2812",
    "name_extensions": [
      "Huyện Ngọc Lặc",
      "H.Ngọc Lặc",
      "H Ngọc Lặc",
      "Ngọc Lặc",
      "Ngoc Lac"
    ]
  },
  {
    "district_id": 1873,
    "district_name": "Huyện Thọ Xuân",
    "province_id": 234,
    "v3_province_id": 1000030,
    "code": "2815",
    "name_extensions": [
      "Huyện Thọ Xuân",
      "H.Thọ Xuân",
      "H Thọ Xuân",
      "Thọ Xuân",
      "Tho Xuan"
    ]
  },
  {
    "district_id": 1872,
    "district_name": "Huyện Thường Xuân",
    "province_id": 234,
    "v3_province_id": 1000030,
    "code": "2808",
    "name_extensions": [
      "Huyện Thường Xuân",
      "H.Thường Xuân",
      "H Thường Xuân",
      "Thường Xuân",
      "Thuong Xuan"
    ]
  },
  {
    "district_id": 1871,
    "district_name": "Huyện Như Xuân",
    "province_id": 234,
    "v3_province_id": 1000030,
    "code": "2809",
    "name_extensions": [
      "Huyện Như Xuân",
      "H.Như Xuân",
      "H Như Xuân",
      "Như Xuân",
      "Nhu Xuan"
    ]
  },
  {
    "district_id": 1870,
    "district_name": "Thị Xã Nghi Sơn",
    "province_id": 234,
    "v3_province_id": 1000030,
    "code": "2826",
    "name_extensions": [
      "Huyện Tĩnh Gia",
      "H.Tĩnh Gia",
      "H Tĩnh Gia",
      "Tĩnh Gia",
      "Tinh Gia"
    ]
  },
  {
    "district_id": 1748,
    "district_name": "Huyện Hoằng Hóa",
    "province_id": 234,
    "v3_province_id": 1000030,
    "code": "2822",
    "name_extensions": [
      "Huyện Hoằng Hóa",
      "H.Hoằng Hóa",
      "H Hoằng Hóa",
      "Hoằng Hóa",
      "Hoang Hoa"
    ]
  },
  {
    "district_id": 1747,
    "district_name": "Huyện Quảng Xương",
    "province_id": 234,
    "v3_province_id": 1000030,
    "code": "2825",
    "name_extensions": [
      "Huyện Quảng Xương",
      "H.Quảng Xương",
      "H Quảng Xương",
      "Quảng Xương",
      "Quang Xuong"
    ]
  },
  {
    "district_id": 1712,
    "district_name": "Thành phố Sầm Sơn",
    "province_id": 234,
    "v3_province_id": 1000030,
    "code": "2803",
    "name_extensions": [
      "Thị xã Sầm Sơn",
      "TX.Sầm Sơn",
      "TX Sầm Sơn",
      "Sầm Sơn",
      "Sam Son"
    ]
  },
  {
    "district_id": 1616,
    "district_name": "Thành phố Thanh Hóa",
    "province_id": 234,
    "v3_province_id": 1000030,
    "code": "2801",
    "name_extensions": [
      "Thành phố Thanh Hóa",
      "TP.Thanh Hóa",
      "TP Thanh Hóa",
      "Thanh Hóa",
      "Thanh Hoa"
    ]
  },
  {
    "district_id": 3441,
    "district_name": "Thị xã Kỳ Anh",
    "province_id": 236,
    "v3_province_id": 1000029,
    "code": "3013",
    "name_extensions": [
      "Thị xã Kỳ Anh",
      "TX.Kỳ Anh",
      "TX Kỳ Anh",
      "Thi xa Ky Anh"
    ]
  },
  {
    "district_id": 3320,
    "district_name": "Huyện Vũ Quang",
    "province_id": 236,
    "v3_province_id": 1000029,
    "code": "3011",
    "name_extensions": [
      "Huyện Vũ Quang",
      "H.Vũ Quang",
      "H Vũ Quang",
      "Vũ Quang",
      "Vu Quang"
    ]
  },
  {
    "district_id": 3220,
    "district_name": "Huyện Lộc Hà",
    "province_id": 236,
    "v3_province_id": 1000029,
    "code": "3012",
    "name_extensions": [
      "Huyện Lộc Hà",
      "H.Lộc Hà",
      "H Lộc Hà",
      "Lộc Hà",
      "Loc Ha"
    ]
  },
  {
    "district_id": 3201,
    "district_name": "Huyện Hương Sơn",
    "province_id": 236,
    "v3_province_id": 1000029,
    "code": "3003",
    "name_extensions": [
      "Huyện Hương Sơn",
      "H.Hương Sơn",
      "H Hương Sơn",
      "Hương Sơn",
      "Huong Son"
    ]
  },
  {
    "district_id": 3188,
    "district_name": "Huyện Đức Thọ",
    "province_id": 236,
    "v3_province_id": 1000029,
    "code": "3004",
    "name_extensions": [
      "Huyện Đức Thọ",
      "H.Đức Thọ",
      "H Đức Thọ",
      "Đức Thọ",
      "Duc Tho"
    ]
  },
  {
    "district_id": 3143,
    "district_name": "Huyện Can Lộc",
    "province_id": 236,
    "v3_province_id": 1000029,
    "code": "3006",
    "name_extensions": [
      "Huyện Can Lộc",
      "H.Can Lộc",
      "H Can Lộc",
      "Can Lộc",
      "Can Loc"
    ]
  },
  {
    "district_id": 2024,
    "district_name": "Huyện Thạch Hà",
    "province_id": 236,
    "v3_province_id": 1000029,
    "code": "3008",
    "name_extensions": [
      "Huyện Thạch Hà",
      "H.Thạch Hà",
      "H Thạch Hà",
      "Thạch Hà",
      "Thach Ha"
    ]
  },
  {
    "district_id": 1815,
    "district_name": "Huyện Cẩm Xuyên",
    "province_id": 236,
    "v3_province_id": 1000029,
    "code": "3009",
    "name_extensions": [
      "Huyện Cẩm Xuyên",
      "H.Cẩm Xuyên",
      "H Cẩm Xuyên",
      "Cẩm Xuyên",
      "Cam Xuyen"
    ]
  },
  {
    "district_id": 1814,
    "district_name": "Thị xã Hồng Lĩnh",
    "province_id": 236,
    "v3_province_id": 1000029,
    "code": "3002",
    "name_extensions": [
      "Thị xã Hồng Lĩnh",
      "TX.Hồng Lĩnh",
      "TX Hồng Lĩnh",
      "Hồng Lĩnh",
      "Hong Linh"
    ]
  },
  {
    "district_id": 1813,
    "district_name": "Huyện Nghi Xuân",
    "province_id": 236,
    "v3_province_id": 1000029,
    "code": "3005",
    "name_extensions": [
      "Huyện Nghi Xuân",
      "H.Nghi Xuân",
      "H Nghi Xuân",
      "Nghi Xuân",
      "Nghi Xuan"
    ]
  },
  {
    "district_id": 1812,
    "district_name": "Huyện Hương Khê",
    "province_id": 236,
    "v3_province_id": 1000029,
    "code": "3007",
    "name_extensions": [
      "Huyện Hương Khê",
      "H.Hương Khê",
      "H Hương Khê",
      "Hương Khê",
      "Huong Khe"
    ]
  },
  {
    "district_id": 1811,
    "district_name": "Huyện Kỳ Anh",
    "province_id": 236,
    "v3_province_id": 1000029,
    "code": "3010",
    "name_extensions": [
      "Huyện Kỳ Anh",
      "H.Kỳ Anh",
      "H Kỳ Anh",
      "Kỳ Anh",
      "Ky Anh"
    ]
  },
  {
    "district_id": 1618,
    "district_name": "Thành phố Hà Tĩnh",
    "province_id": 236,
    "v3_province_id": 1000029,
    "code": "3001",
    "name_extensions": [
      "Thành phố Hà Tĩnh",
      "TP.Hà Tĩnh",
      "TP Hà Tĩnh",
      "Hà Tĩnh",
      "Ha Tinh"
    ]
  },
  {
    "district_id": 3199,
    "district_name": "Huyện Hoành Bồ",
    "province_id": 230,
    "v3_province_id": 1000028,
    "code": "1712",
    "name_extensions": [
      "Huyện Hoành Bồ",
      "H.Hoành Bồ",
      "H Hoành Bồ",
      "Hoành Bồ",
      "Hoanh Bo"
    ]
  },
  {
    "district_id": 3185,
    "district_name": "Thị xã Đông Triều",
    "province_id": 230,
    "v3_province_id": 1000028,
    "code": "1710",
    "name_extensions": [
      "Huyện Đông Triều",
      "Thị Xã Đông Triều",
      "H.Đông Triều",
      "H Đông Triều",
      "Đông Triều"
    ]
  },
  {
    "district_id": 3180,
    "district_name": "Huyện Đầm Hà",
    "province_id": 230,
    "v3_province_id": 1000028,
    "code": "1706",
    "name_extensions": [
      "Huyện Đầm Hà",
      "H.Đầm Hà",
      "H Đầm Hà",
      "Đầm Hà",
      "Dam Ha"
    ]
  },
  {
    "district_id": 3126,
    "district_name": "Huyện Ba Chẽ",
    "province_id": 230,
    "v3_province_id": 1000028,
    "code": "1709",
    "name_extensions": [
      "Huyện Ba Chẽ",
      "H.Ba Chẽ",
      "H Ba Chẽ",
      "Ba Chẽ",
      "Ba Che"
    ]
  },
  {
    "district_id": 2109,
    "district_name": "Huyện đảo Cô Tô",
    "province_id": 230,
    "v3_province_id": 1000028,
    "code": "1714",
    "name_extensions": [
      "Huyện đảo Cô Tô",
      "Huyện Cô Tô",
      "Cô Tô",
      "Co To",
      "Huyen dao Co To"
    ]
  },
  {
    "district_id": 2066,
    "district_name": "Thị xã Quảng Yên",
    "province_id": 230,
    "v3_province_id": 1000028,
    "code": "1711",
    "name_extensions": [
      "Thị xã Quảng Yên",
      "TX.Quảng Yên",
      "TX Quảng Yên",
      "Quảng Yên",
      "Quang Yen"
    ]
  },
  {
    "district_id": 2019,
    "district_name": "Huyện Tiên Yên",
    "province_id": 230,
    "v3_province_id": 1000028,
    "code": "1708",
    "name_extensions": [
      "Huyện Tiên Yên",
      "H.Tiên Yên",
      "H Tiên Yên",
      "Tiên Yên",
      "Tien Yen"
    ]
  },
  {
    "district_id": 1940,
    "district_name": "Huyện Hải Hà",
    "province_id": 230,
    "v3_province_id": 1000028,
    "code": "1707",
    "name_extensions": [
      "Huyện Hải Hà",
      "H.Hải Hà",
      "H Hải Hà",
      "Hải Hà",
      "Hai Ha"
    ]
  },
  {
    "district_id": 1920,
    "district_name": "Huyện đảo Vân Đồn",
    "province_id": 230,
    "v3_province_id": 1000028,
    "code": "1713",
    "name_extensions": [
      "Huyện đảo Vân Đồn",
      "Huyện Vân Đồn",
      "Vân Đồn",
      "Van Don",
      "Huyen Van Don"
    ]
  },
  {
    "district_id": 1896,
    "district_name": "Huyện Bình Liêu",
    "province_id": 230,
    "v3_province_id": 1000028,
    "code": "1705",
    "name_extensions": [
      "Huyện Bình Liêu",
      "H.Bình Liêu",
      "H Bình Liêu",
      "Bình Liêu",
      "Binh Lieu"
    ]
  },
  {
    "district_id": 1686,
    "district_name": "Thành phố Uông Bí",
    "province_id": 230,
    "v3_province_id": 1000028,
    "code": "1703",
    "name_extensions": [
      "Thành phố Uông Bí",
      "TP.Uông Bí",
      "TP Uông Bí",
      "Uông Bí",
      "Uong Bi"
    ]
  },
  {
    "district_id": 1683,
    "district_name": "Thành phố Cẩm Phả",
    "province_id": 230,
    "v3_province_id": 1000028,
    "code": "1702",
    "name_extensions": [
      "Thành phố Cẩm Phả",
      "TP.Cẩm Phả",
      "TP Cẩm Phả",
      "Cẩm Phả",
      "Cam Pha"
    ]
  },
  {
    "district_id": 1604,
    "district_name": "Thành phố Hạ Long",
    "province_id": 230,
    "v3_province_id": 1000028,
    "code": "1701",
    "name_extensions": [
      "Thành phố Hạ Long",
      "TP.Hạ Long",
      "TP Hạ Long",
      "Hạ Long",
      "Ha Long"
    ]
  },
  {
    "district_id": 1603,
    "district_name": "Thành phố Móng Cái",
    "province_id": 230,
    "v3_province_id": 1000028,
    "code": "1704",
    "name_extensions": [
      "Thành phố Móng Cái",
      "TP.Móng Cái",
      "TP Móng Cái",
      "Móng Cái",
      "Mong Cai"
    ]
  },
  {
    "district_id": 3266,
    "district_name": "huyện Sốp Cộp",
    "province_id": 266,
    "v3_province_id": 1000027,
    "code": "1411",
    "name_extensions": [
      "huyện Sốp Cộp",
      "Sop Cop",
      "huyen Sop Cop",
      "sopcop"
    ]
  },
  {
    "district_id": 3230,
    "district_name": "Huyện Mường La",
    "province_id": 266,
    "v3_province_id": 1000027,
    "code": "1403",
    "name_extensions": [
      "Huyện Mường La",
      "H.Mường La",
      "H Mường La",
      "Mường La",
      "Muong La"
    ]
  },
  {
    "district_id": 2267,
    "district_name": "Huyện Yên Châu",
    "province_id": 266,
    "v3_province_id": 1000027,
    "code": "1408",
    "name_extensions": [
      "Huyện Yên Châu",
      "H.Yên Châu",
      "H Yên Châu",
      "Yên Châu",
      "Yen Chau"
    ]
  },
  {
    "district_id": 2255,
    "district_name": "Huyện Vân Hồ",
    "province_id": 266,
    "v3_province_id": 1000027,
    "code": "1412",
    "name_extensions": [
      "Huyện Vân Hồ",
      "H.Vân Hồ",
      "H Vân Hồ",
      "Vân Hồ",
      "Van Ho"
    ]
  },
  {
    "district_id": 2204,
    "district_name": "Huyện Quỳnh Nhai",
    "province_id": 266,
    "v3_province_id": 1000027,
    "code": "1402",
    "name_extensions": [
      "Huyện Quỳnh Nhai",
      "H.Quỳnh Nhai",
      "H Quỳnh Nhai",
      "Quỳnh Nhai",
      "Quynh Nhai"
    ]
  },
  {
    "district_id": 2079,
    "district_name": "Huyện Bắc Yên",
    "province_id": 266,
    "v3_province_id": 1000027,
    "code": "1405",
    "name_extensions": [
      "Huyện Bắc Yên",
      "H.Bắc Yên",
      "H Bắc Yên",
      "Bắc Yên",
      "Bac Yen"
    ]
  },
  {
    "district_id": 2032,
    "district_name": "Huyện Thuận Châu",
    "province_id": 266,
    "v3_province_id": 1000027,
    "code": "1404",
    "name_extensions": [
      "Huyện Thuận Châu",
      "H.Thuận Châu",
      "H Thuận Châu",
      "Thuận Châu",
      "Thuan Chau"
    ]
  },
  {
    "district_id": 2007,
    "district_name": "Huyện Sông Mã",
    "province_id": 266,
    "v3_province_id": 1000027,
    "code": "1409",
    "name_extensions": [
      "Huyện Sông Mã",
      "H.Sông Mã",
      "H Sông Mã",
      "Sông Mã",
      "Song Ma"
    ]
  },
  {
    "district_id": 1996,
    "district_name": "Huyện Phù Yên",
    "province_id": 266,
    "v3_province_id": 1000027,
    "code": "1406",
    "name_extensions": [
      "Huyện Phù Yên",
      "H.Phù Yên",
      "H Phù Yên",
      "Phù Yên",
      "Phu Yen"
    ]
  },
  {
    "district_id": 1976,
    "district_name": "Huyện Mộc Châu",
    "province_id": 266,
    "v3_province_id": 1000027,
    "code": "1410",
    "name_extensions": [
      "Huyện Mộc Châu",
      "H.Mộc Châu",
      "H Mộc Châu",
      "Mộc Châu",
      "Moc Chau"
    ]
  },
  {
    "district_id": 1971,
    "district_name": "Huyện Mai Sơn",
    "province_id": 266,
    "v3_province_id": 1000027,
    "code": "1407",
    "name_extensions": [
      "Huyện Mai Sơn",
      "H.Mai Sơn",
      "H Mai Sơn",
      "Mai Sơn",
      "Mai Son"
    ]
  },
  {
    "district_id": 1677,
    "district_name": "Thành phố Sơn La",
    "province_id": 266,
    "v3_province_id": 1000027,
    "code": "1401",
    "name_extensions": [
      "Thành phố Sơn La",
      "TP.Sơn La",
      "TP Sơn La",
      "Sơn La",
      "Son La"
    ]
  },
  {
    "district_id": 2179,
    "district_name": "Huyện Nậm Pồ",
    "province_id": 265,
    "v3_province_id": 1000026,
    "code": "6210",
    "name_extensions": [
      "Huyện Nậm Pồ",
      "H.Nậm Pồ",
      "H Nậm Pồ",
      "Nậm Pồ",
      "Nam Po"
    ]
  },
  {
    "district_id": 2170,
    "district_name": "Huyện Mường Ảng",
    "province_id": 265,
    "v3_province_id": 1000026,
    "code": "6209",
    "name_extensions": [
      "Huyện Mường Ảng",
      "Huyện Mường Áng",
      "H.Mường Ảng",
      "H Mường Ảng",
      "Mường Ảng"
    ]
  },
  {
    "district_id": 2123,
    "district_name": "Huyện Điện Biên Đông",
    "province_id": 265,
    "v3_province_id": 1000026,
    "code": "6207",
    "name_extensions": [
      "Huyện Điện Biên Đông",
      "H.Điện Biên Đông",
      "H Điện Biên Đông",
      "Điện Biên Đông",
      "Dien Bien Dong"
    ]
  },
  {
    "district_id": 2060,
    "district_name": "Thị xã Mường Lay",
    "province_id": 265,
    "v3_province_id": 1000026,
    "code": "6202",
    "name_extensions": [
      "Thị xã Mường Lay",
      "TX.Mường Lay",
      "TX Mường Lay",
      "Mường Lay",
      "Muong Lay"
    ]
  },
  {
    "district_id": 2022,
    "district_name": "Huyện Tuần Giáo",
    "province_id": 265,
    "v3_province_id": 1000026,
    "code": "6204",
    "name_extensions": [
      "Huyện Tuần Giáo",
      "H.Tuần Giáo",
      "H Tuần Giáo",
      "Tuần Giáo",
      "Tuan Giao"
    ]
  },
  {
    "district_id": 2021,
    "district_name": "Huyện Tủa Chùa",
    "province_id": 265,
    "v3_province_id": 1000026,
    "code": "6206",
    "name_extensions": [
      "Huyện Tủa Chùa",
      "H.Tủa Chùa",
      "H Tủa Chùa",
      "Tủa Chùa",
      "Tua Chua"
    ]
  },
  {
    "district_id": 1979,
    "district_name": "Huyện Mường Nhé",
    "province_id": 265,
    "v3_province_id": 1000026,
    "code": "6208",
    "name_extensions": [
      "Huyện Mường Nhé",
      "H.Mường Nhé",
      "H Mường Nhé",
      "Mường Nhé",
      "Muong Nhe"
    ]
  },
  {
    "district_id": 1978,
    "district_name": "Huyện Mường Chà",
    "province_id": 265,
    "v3_province_id": 1000026,
    "code": "6205",
    "name_extensions": [
      "Huyện Mường Chà",
      "H.Mường Chà",
      "H Mường Chà",
      "Mường Chà",
      "Muong Cha"
    ]
  },
  {
    "district_id": 1923,
    "district_name": "Huyện Điện Biên",
    "province_id": 265,
    "v3_province_id": 1000026,
    "code": "6203",
    "name_extensions": [
      "Huyện Điện Biên",
      "H.Điện Biên",
      "H Điện Biên",
      "Điện Biên",
      "Dien Bien"
    ]
  },
  {
    "district_id": 1676,
    "district_name": "Thành phố Điện Biên Phủ",
    "province_id": 265,
    "v3_province_id": 1000026,
    "code": "6201",
    "name_extensions": [
      "Thành phố Điện Biên Phủ",
      "TP.Điện Biên Phủ",
      "TP Điện Biên Phủ",
      "Điện Biên Phủ",
      "Dien Bien Phu"
    ]
  },
  {
    "district_id": 2025,
    "district_name": "Huyện Than Uyên",
    "province_id": 264,
    "v3_province_id": 1000025,
    "code": "0706",
    "name_extensions": [
      "Huyện Than Uyên",
      "H.Than Uyên",
      "H Than Uyên",
      "Than Uyên",
      "Than Uyen"
    ]
  },
  {
    "district_id": 2017,
    "district_name": "Huyện Tân Uyên",
    "province_id": 264,
    "v3_province_id": 1000025,
    "code": "0707",
    "name_extensions": [
      "Huyện Tân Uyên",
      "H.Tân Uyên",
      "H Tân Uyên",
      "Tân Uyên",
      "Tan Uyen"
    ]
  },
  {
    "district_id": 2010,
    "district_name": "Huyện Tam Đường",
    "province_id": 264,
    "v3_province_id": 1000025,
    "code": "0702",
    "name_extensions": [
      "Huyện Tam Đường",
      "H.Tam Đường",
      "H Tam Đường",
      "Tam Đường",
      "Tam Duong"
    ]
  },
  {
    "district_id": 2006,
    "district_name": "Huyện Sìn Hồ",
    "province_id": 264,
    "v3_province_id": 1000025,
    "code": "0704",
    "name_extensions": [
      "Huyện Sìn Hồ",
      "H.Sìn Hồ",
      "H Sìn Hồ",
      "Sìn Hồ",
      "Sin Ho"
    ]
  },
  {
    "district_id": 1989,
    "district_name": "Huyện Phong Thổ",
    "province_id": 264,
    "v3_province_id": 1000025,
    "code": "0703",
    "name_extensions": [
      "Huyện Phong Thổ",
      "H.Phong Thổ",
      "H Phong Thổ",
      "Phong Thổ",
      "Phong Tho"
    ]
  },
  {
    "district_id": 1984,
    "district_name": "Huyện Nậm Nhùn",
    "province_id": 264,
    "v3_province_id": 1000025,
    "code": "0708",
    "name_extensions": [
      "Huyện Nậm Nhùm",
      "Huyện Nậm Nhùn",
      "H.Nậm Nhùm",
      "H.Nậm Nhùn",
      "H Nậm Nhùm"
    ]
  },
  {
    "district_id": 1980,
    "district_name": "Huyện Mường Tè",
    "province_id": 264,
    "v3_province_id": 1000025,
    "code": "0705",
    "name_extensions": [
      "Huyện Mường Tè",
      "H.Mường Tè",
      "H Mường Tè",
      "Mường Tè",
      "Muong Te"
    ]
  },
  {
    "district_id": 1675,
    "district_name": "Thành phố Lai Châu",
    "province_id": 264,
    "v3_province_id": 1000025,
    "code": "0701",
    "name_extensions": [
      "Thành phố Lai Châu",
      "TP.Lai Châu",
      "TP Lai Châu",
      "Lai Châu",
      "Lai Chau"
    ]
  },
  {
    "district_id": 2264,
    "district_name": "Huyện Si Ma Cai",
    "province_id": 269,
    "v3_province_id": 1000024,
    "code": "0802",
    "name_extensions": [
      "Huyện Xi Ma Cai",
      "Huyện Si Ma Cai",
      "H.Xi Ma Cai",
      "H Xi Ma Cai",
      "Xi Ma Cai"
    ]
  },
  {
    "district_id": 2171,
    "district_name": "Huyện Mường Khương",
    "province_id": 269,
    "v3_province_id": 1000024,
    "code": "0809",
    "name_extensions": [
      "Huyện Mường Khương",
      "H.Mường Khương",
      "H Mường Khương",
      "Mường Khương",
      "Muong Khuong"
    ]
  },
  {
    "district_id": 2073,
    "district_name": "Huyện Bảo Thắng",
    "province_id": 269,
    "v3_province_id": 1000024,
    "code": "0804",
    "name_extensions": [
      "Huyện Bảo Thắng",
      "H.Bảo Thắng",
      "H Bảo Thắng",
      "Bảo Thắng",
      "Bao Thang"
    ]
  },
  {
    "district_id": 2043,
    "district_name": "Huyện Văn Bàn",
    "province_id": 269,
    "v3_province_id": 1000024,
    "code": "0806",
    "name_extensions": [
      "Huyện Văn Bàn",
      "H.Văn Bàn",
      "H Văn Bàn",
      "Văn Bàn",
      "Van Ban"
    ]
  },
  {
    "district_id": 2005,
    "district_name": "Thị xã Sa Pa",
    "province_id": 269,
    "v3_province_id": 1000024,
    "code": "0805",
    "name_extensions": [
      "Huyện Sa Pa",
      "H.Sa Pa",
      "H Sa Pa",
      "Sa Pa",
      "Huyen Sa Pa"
    ]
  },
  {
    "district_id": 1892,
    "district_name": "Huyện Bắc Hà",
    "province_id": 269,
    "v3_province_id": 1000024,
    "code": "0808",
    "name_extensions": [
      "Huyện Bắc Hà",
      "H.Bắc Hà",
      "H Bắc Hà",
      "Bắc Hà",
      "Bac Ha"
    ]
  },
  {
    "district_id": 1891,
    "district_name": "Huyện Bảo Yên",
    "province_id": 269,
    "v3_province_id": 1000024,
    "code": "0807",
    "name_extensions": [
      "Huyện Bảo Yên",
      "H.Bảo Yên",
      "H Bảo Yên",
      "Bảo Yên",
      "Bao Yen"
    ]
  },
  {
    "district_id": 1744,
    "district_name": "Huyện Bát Xát",
    "province_id": 269,
    "v3_province_id": 1000024,
    "code": "0803",
    "name_extensions": [
      "Huyện Bát Xát",
      "H.Bát Xát",
      "H Bát Xát",
      "Bát Xát",
      "Bat Xat"
    ]
  },
  {
    "district_id": 1682,
    "district_name": "Thành phố Lào Cai",
    "province_id": 269,
    "v3_province_id": 1000024,
    "code": "0801",
    "name_extensions": [
      "Thành phố Lào Cai",
      "TP.Lào Cai",
      "TP Lào Cai",
      "Lào Cai",
      "Lao Cai"
    ]
  },
  {
    "district_id": 3451,
    "district_name": "Quận Đặc Biệt",
    "province_id": 268,
    "v3_province_id": 1000023,
    "code": "9505",
    "name_extensions": []
  },
  {
    "district_id": 2194,
    "district_name": "Huyện Phù Cừ",
    "province_id": 268,
    "v3_province_id": 1000023,
    "code": "2207",
    "name_extensions": [
      "Huyện Phù Cừ",
      "H.Phù Cừ",
      "H Phù Cừ",
      "Phù Cừ",
      "Phu Cu"
    ]
  },
  {
    "district_id": 2046,
    "district_name": "Huyện Văn Lâm",
    "province_id": 268,
    "v3_province_id": 1000023,
    "code": "2209",
    "name_extensions": [
      "Huyện Văn Lâm",
      "H.Văn Lâm",
      "H Văn Lâm",
      "Văn Lâm",
      "Van Lam"
    ]
  },
  {
    "district_id": 2045,
    "district_name": "Huyện Văn Giang",
    "province_id": 268,
    "v3_province_id": 1000023,
    "code": "2210",
    "name_extensions": [
      "Huyện Văn Giang",
      "H.Văn Giang",
      "H Văn Giang",
      "Văn Giang",
      "Van Giang"
    ]
  },
  {
    "district_id": 2018,
    "district_name": "Huyện Tiên Lữ",
    "province_id": 268,
    "v3_province_id": 1000023,
    "code": "2206",
    "name_extensions": [
      "Huyện Tiên Lữ",
      "H.Tiên Lữ",
      "H Tiên Lữ",
      "Tiên Lữ",
      "Tien Lu"
    ]
  },
  {
    "district_id": 1828,
    "district_name": "Huyện Yên Mỹ",
    "province_id": 268,
    "v3_province_id": 1000023,
    "code": "2205",
    "name_extensions": [
      "Huyện Yên Mỹ",
      "H.Yên Mỹ",
      "H Yên Mỹ",
      "Yên Mỹ",
      "Yen My"
    ]
  },
  {
    "district_id": 1827,
    "district_name": "Thị xã Mỹ Hào",
    "province_id": 268,
    "v3_province_id": 1000023,
    "code": "2208",
    "name_extensions": [
      "Huyện Mỹ Hào",
      "H.Mỹ Hào",
      "H Mỹ Hào",
      "Mỹ Hào",
      "My Hao"
    ]
  },
  {
    "district_id": 1826,
    "district_name": "Huyện Khoái Châu",
    "province_id": 268,
    "v3_province_id": 1000023,
    "code": "2204",
    "name_extensions": [
      "Huyện Khoái Châu",
      "H.Khoái Châu",
      "H Khoái Châu",
      "Khoái Châu",
      "Khoai Chau"
    ]
  },
  {
    "district_id": 1825,
    "district_name": "Huyện Ân Thi",
    "province_id": 268,
    "v3_province_id": 1000023,
    "code": "2203",
    "name_extensions": [
      "Huyện Ân Thi",
      "H.Ân Thi",
      "H Ân Thi",
      "Ân Thi",
      "An Thi"
    ]
  },
  {
    "district_id": 1717,
    "district_name": "Huyện Kim Động",
    "province_id": 268,
    "v3_province_id": 1000023,
    "code": "2202",
    "name_extensions": [
      "Huyện Kim Động",
      "H.Kim Động",
      "H Kim Động",
      "Kim Động",
      "Kim Dong"
    ]
  },
  {
    "district_id": 1680,
    "district_name": "Thành phố Hưng Yên",
    "province_id": 268,
    "v3_province_id": 1000023,
    "code": "2201",
    "name_extensions": [
      "Thành phố Hưng Yên",
      "TP.Hưng Yên",
      "TP Hưng Yên",
      "Hưng Yên",
      "Hung Yen"
    ]
  },
  {
    "district_id": 2186,
    "district_name": "Huyện Ngọc Hiển",
    "province_id": 252,
    "v3_province_id": 1000022,
    "code": "6107",
    "name_extensions": [
      "Huyện Ngọc Hiển",
      "H.Ngọc Hiển",
      "H Ngọc Hiển",
      "Ngọc Hiển",
      "Ngoc Hien"
    ]
  },
  {
    "district_id": 2042,
    "district_name": "Huyện U Minh",
    "province_id": 252,
    "v3_province_id": 1000022,
    "code": "6103",
    "name_extensions": [
      "Huyện U Minh",
      "H.U Minh",
      "H U Minh",
      "U Minh",
      "Huyen U Minh"
    ]
  },
  {
    "district_id": 2038,
    "district_name": "Huyện Trần Văn Thời",
    "province_id": 252,
    "v3_province_id": 1000022,
    "code": "6104",
    "name_extensions": [
      "Huyện Trần Văn Thời",
      "H.Trần Văn Thời",
      "H Trần Văn Thời",
      "Trần Văn Thời",
      "Tran Van Thoi"
    ]
  },
  {
    "district_id": 1922,
    "district_name": "Huyện Đầm Dơi",
    "province_id": 252,
    "v3_province_id": 1000022,
    "code": "6106",
    "name_extensions": [
      "Huyện Đầm Dơi",
      "H.Đầm Dơi",
      "H Đầm Dơi",
      "Đầm Dơi",
      "Dam Doi"
    ]
  },
  {
    "district_id": 1901,
    "district_name": "Huyện Cái Nước",
    "province_id": 252,
    "v3_province_id": 1000022,
    "code": "6105",
    "name_extensions": [
      "Huyện Cái Nước",
      "H.Cái Nước",
      "H Cái Nước",
      "Cái Nước",
      "Cai Nuoc"
    ]
  },
  {
    "district_id": 1883,
    "district_name": "Huyện Phú Tân",
    "province_id": 252,
    "v3_province_id": 1000022,
    "code": "6109",
    "name_extensions": [
      "Huyện Phú Tân",
      "H.Phú Tân",
      "H Phú Tân",
      "Phú Tân",
      "Phu Tan"
    ]
  },
  {
    "district_id": 1783,
    "district_name": "Huyện Năm Căn",
    "province_id": 252,
    "v3_province_id": 1000022,
    "code": "6108",
    "name_extensions": [
      "Huyện Năm Căn",
      "H.Năm Căn",
      "H Năm Căn",
      "Năm Căn",
      "Nam Can"
    ]
  },
  {
    "district_id": 1782,
    "district_name": "Huyện Thới Bình",
    "province_id": 252,
    "v3_province_id": 1000022,
    "code": "6102",
    "name_extensions": [
      "Huyện Thới Bình",
      "H.Thới Bình",
      "H Thới Bình",
      "Thới Bình",
      "Thoi Binh"
    ]
  },
  {
    "district_id": 1654,
    "district_name": "Thành phố Cà Mau",
    "province_id": 252,
    "v3_province_id": 1000022,
    "code": "6101",
    "name_extensions": [
      "Thành phố Cà Mau",
      "TP.Cà Mau",
      "TP Cà Mau",
      "Cà Mau",
      "Ca Mau"
    ]
  },
  {
    "district_id": 1969,
    "district_name": "Huyện Lương Tài",
    "province_id": 249,
    "v3_province_id": 1000021,
    "code": "1908",
    "name_extensions": [
      "Huyện Lương Tài",
      "H.Lương Tài",
      "H Lương Tài",
      "Lương Tài",
      "Luong Tai"
    ]
  },
  {
    "district_id": 1768,
    "district_name": "Huyện Yên Phong",
    "province_id": 249,
    "v3_province_id": 1000021,
    "code": "1902",
    "name_extensions": [
      "Huyện Yên Phong",
      "H.Yên Phong",
      "H Yên Phong",
      "Yên Phong",
      "Yen Phong"
    ]
  },
  {
    "district_id": 1767,
    "district_name": "Thị xã Thuận Thành",
    "province_id": 249,
    "v3_province_id": 1000021,
    "code": "1906",
    "name_extensions": [
      "Huyện Thuận Thành",
      "H.Thuận Thành",
      "H Thuận Thành",
      "Thuận Thành",
      "Thuan Thanh"
    ]
  },
  {
    "district_id": 1766,
    "district_name": "Huyện Gia Bình",
    "province_id": 249,
    "v3_province_id": 1000021,
    "code": "1907",
    "name_extensions": [
      "Huyện Gia Bình",
      "H.Gia Bình",
      "H Gia Bình",
      "Gia Bình",
      "Gia Binh"
    ]
  },
  {
    "district_id": 1730,
    "district_name": "Thị xã Từ Sơn",
    "province_id": 249,
    "v3_province_id": 1000021,
    "code": "1905",
    "name_extensions": [
      "Thị xã Từ Sơn",
      "TX.Từ Sơn",
      "TX Từ Sơn",
      "Từ Sơn",
      "Tu Son"
    ]
  },
  {
    "district_id": 1729,
    "district_name": "Huyện Tiên Du",
    "province_id": 249,
    "v3_province_id": 1000021,
    "code": "1904",
    "name_extensions": [
      "Huyện Tiên Du",
      "H.Tiên Du",
      "H Tiên Du",
      "Tiên Du",
      "Tien Du"
    ]
  },
  {
    "district_id": 1728,
    "district_name": "Huyện Quế Võ",
    "province_id": 249,
    "v3_province_id": 1000021,
    "code": "1903",
    "name_extensions": [
      "Huyện Quế Võ",
      "H.Quế Võ",
      "H Quế Võ",
      "Quế Võ",
      "Que Vo"
    ]
  },
  {
    "district_id": 1644,
    "district_name": "Thành phố Bắc Ninh",
    "province_id": 249,
    "v3_province_id": 1000021,
    "code": "1901",
    "name_extensions": [
      "Thành phố Bắc Ninh",
      "TP.Bắc Ninh",
      "TP Bắc Ninh",
      "Bắc Ninh",
      "Bac Ninh"
    ]
  },
  {
    "district_id": 2195,
    "district_name": "Huyện Phú Lương",
    "province_id": 244,
    "v3_province_id": 1000020,
    "code": "1204",
    "name_extensions": [
      "Huyện Phú Lương",
      "H.Phú Lương",
      "H Phú Lương",
      "Phú Lương",
      "Phu Luong"
    ]
  },
  {
    "district_id": 2051,
    "district_name": "Huyện Võ Nhai",
    "province_id": 244,
    "v3_province_id": 1000020,
    "code": "1205",
    "name_extensions": [
      "Huyện Võ Nhai",
      "H.Võ Nhai",
      "H Võ Nhai",
      "Võ Nhai",
      "Vo Nhai"
    ]
  },
  {
    "district_id": 1991,
    "district_name": "Huyện Phú Bình",
    "province_id": 244,
    "v3_province_id": 1000020,
    "code": "1208",
    "name_extensions": [
      "Huyện Phú Bình",
      "H.Phú Bình",
      "H Phú Bình",
      "Phú Bình",
      "Phu Binh"
    ]
  },
  {
    "district_id": 1990,
    "district_name": "Thị xã Phổ Yên",
    "province_id": 244,
    "v3_province_id": 1000020,
    "code": "1209",
    "name_extensions": [
      "Huyện Phổ Yên",
      "Thị Xã Phổ Yên",
      "H.Phổ Yên",
      "H Phổ Yên",
      "Phổ Yên"
    ]
  },
  {
    "district_id": 1924,
    "district_name": "Huyện Định Hóa",
    "province_id": 244,
    "v3_province_id": 1000020,
    "code": "1203",
    "name_extensions": [
      "Huyện Định Hóa",
      "H.Định Hóa",
      "H Định Hóa",
      "Định Hóa",
      "Dinh Hoa"
    ]
  },
  {
    "district_id": 1918,
    "district_name": "Huyện Đại Từ",
    "province_id": 244,
    "v3_province_id": 1000020,
    "code": "1206",
    "name_extensions": [
      "Huyện Đại Từ",
      "H.Đại Từ",
      "H Đại Từ",
      "Đại Từ",
      "Dai Tu"
    ]
  },
  {
    "district_id": 1731,
    "district_name": "Huyện Đồng Hỷ",
    "province_id": 244,
    "v3_province_id": 1000020,
    "code": "1207",
    "name_extensions": [
      "Huyện Đồng Hỷ",
      "H.Đồng Hỷ",
      "H Đồng Hỷ",
      "Đồng Hỷ",
      "Dong Hy"
    ]
  },
  {
    "district_id": 1684,
    "district_name": "Thành Phố Sông Công",
    "province_id": 244,
    "v3_province_id": 1000020,
    "code": "1202",
    "name_extensions": [
      "Thị xã Sông Công",
      "Thành Phố Sông Công",
      "TX.Sông Công",
      "TX Sông Công",
      "Sông Công"
    ]
  },
  {
    "district_id": 1639,
    "district_name": "Thành phố Thái Nguyên",
    "province_id": 244,
    "v3_province_id": 1000020,
    "code": "1201",
    "name_extensions": [
      "Thành phố Thái Nguyên",
      "TP.Thái Nguyên",
      "TP Thái Nguyên",
      "Thái Nguyên",
      "Thai Nguyen"
    ]
  },
  {
    "district_id": 3304,
    "district_name": "Huyện Trà Bồng",
    "province_id": 242,
    "v3_province_id": 1000019,
    "code": "3504",
    "name_extensions": [
      "Huyện Trà Bồng",
      "H.Trà Bồng",
      "H Trà Bồng",
      "Trà Bồng",
      "Tra Bong"
    ]
  },
  {
    "district_id": 3270,
    "district_name": "Huyện Sơn Tây",
    "province_id": 242,
    "v3_province_id": 1000019,
    "code": "3513",
    "name_extensions": [
      "Huyện Sơn Tây",
      "H.Sơn Tây",
      "H Sơn Tây",
      "Sơn Tây",
      "Son Tay"
    ]
  },
  {
    "district_id": 3226,
    "district_name": "Huyện Mộ Đức",
    "province_id": 242,
    "v3_province_id": 1000019,
    "code": "3510",
    "name_extensions": [
      "Huyện Mộ Đức",
      "H.Mộ Đức",
      "H Mộ Đức",
      "Mộ Đức",
      "Mo Duc"
    ]
  },
  {
    "district_id": 3127,
    "district_name": "Huyện Ba Tơ",
    "province_id": 242,
    "v3_province_id": 1000019,
    "code": "3512",
    "name_extensions": [
      "Huyện Ba Tơ",
      "H.Ba Tơ",
      "H Ba Tơ",
      "Ba Tơ",
      "Ba To"
    ]
  },
  {
    "district_id": 2222,
    "district_name": "Huyện Tây Trà",
    "province_id": 242,
    "v3_province_id": 1000019,
    "code": "3514",
    "name_extensions": [
      "Huyện Tây Trà",
      "H.Tây Trà",
      "H Tây Trà",
      "Tây Trà",
      "Tay Tra"
    ]
  },
  {
    "district_id": 2210,
    "district_name": "Huyện Sơn Hà",
    "province_id": 242,
    "v3_province_id": 1000019,
    "code": "3506",
    "name_extensions": [
      "Huyện Sơn Hà",
      "H.Sơn Hà",
      "H Sơn Hà",
      "Sơn Hà",
      "Son Ha"
    ]
  },
  {
    "district_id": 2167,
    "district_name": "Huyện Minh Long",
    "province_id": 242,
    "v3_province_id": 1000019,
    "code": "3509",
    "name_extensions": [
      "Huyện Minh Long",
      "H.Minh Long",
      "H Minh Long",
      "Minh Long",
      "Huyen Minh Long"
    ]
  },
  {
    "district_id": 2114,
    "district_name": "Huyện đảo Lý Sơn",
    "province_id": 242,
    "v3_province_id": 1000019,
    "code": "3502",
    "name_extensions": [
      "Huyện Lý Sơn",
      "Lý Sơn",
      "Ly Son",
      "Huyen dao Ly Son",
      "lyson"
    ]
  },
  {
    "district_id": 1988,
    "district_name": "Huyện Nghĩa Hành",
    "province_id": 242,
    "v3_province_id": 1000019,
    "code": "3508",
    "name_extensions": [
      "Huyện Nghĩa Hành",
      "H.Nghĩa Hành",
      "H Nghĩa Hành",
      "Nghĩa Hành",
      "Nghia Hanh"
    ]
  },
  {
    "district_id": 1930,
    "district_name": "Thị xã Đức Phổ",
    "province_id": 242,
    "v3_province_id": 1000019,
    "code": "3511",
    "name_extensions": [
      "Huyện Đức Phổ",
      "H.Đức Phổ",
      "H Đức Phổ",
      "Đức Phổ",
      "Duc Pho"
    ]
  },
  {
    "district_id": 1898,
    "district_name": "Huyện Bình Sơn",
    "province_id": 242,
    "v3_province_id": 1000019,
    "code": "3503",
    "name_extensions": [
      "Huyện Bình Sơn",
      "H.Bình Sơn",
      "H Bình Sơn",
      "Bình Sơn",
      "Binh Son"
    ]
  },
  {
    "district_id": 1738,
    "district_name": "Huyện Tư Nghĩa",
    "province_id": 242,
    "v3_province_id": 1000019,
    "code": "3507",
    "name_extensions": [
      "Huyện Tư Nghĩa",
      "H.Tư Nghĩa",
      "H Tư Nghĩa",
      "Tư Nghĩa",
      "Tu Nghia"
    ]
  },
  {
    "district_id": 1737,
    "district_name": "Huyện Sơn Tịnh",
    "province_id": 242,
    "v3_province_id": 1000019,
    "code": "3505",
    "name_extensions": [
      "Huyện Sơn Tịnh",
      "H.Sơn Tịnh",
      "H Sơn Tịnh",
      "Sơn Tịnh",
      "Son Tinh"
    ]
  },
  {
    "district_id": 1630,
    "district_name": "Thành phố Quảng Ngãi",
    "province_id": 242,
    "v3_province_id": 1000019,
    "code": "3501",
    "name_extensions": [
      "Thành phố Quảng Ngãi",
      "TP.Quảng Ngãi",
      "TP Quảng Ngãi",
      "Quảng Ngãi",
      "Quang Ngai"
    ]
  },
  {
    "district_id": 2035,
    "district_name": "Thị xã Trảng Bàng",
    "province_id": 240,
    "v3_province_id": 1000018,
    "code": "4609",
    "name_extensions": [
      "Huyện Trảng Bàng",
      "H.Trảng Bàng",
      "H Trảng Bàng",
      "Trảng Bàng",
      "Trang Bang"
    ]
  },
  {
    "district_id": 1866,
    "district_name": "Huyện Gò Dầu",
    "province_id": 240,
    "v3_province_id": 1000018,
    "code": "4608",
    "name_extensions": [
      "Huyện Gò Dầu",
      "H.Gò Dầu",
      "H Gò Dầu",
      "Gò Dầu",
      "Go Dau"
    ]
  },
  {
    "district_id": 1865,
    "district_name": "Huyện Bến Cầu",
    "province_id": 240,
    "v3_province_id": 1000018,
    "code": "4607",
    "name_extensions": [
      "Huyện Bến Cầu",
      "H.Bến Cầu",
      "H Bến Cầu",
      "Bến Cầu",
      "Ben Cau"
    ]
  },
  {
    "district_id": 1864,
    "district_name": "Huyện Dương Minh Châu",
    "province_id": 240,
    "v3_province_id": 1000018,
    "code": "4604",
    "name_extensions": [
      "Huyện Dương Minh Châu",
      "H.Dương Minh Châu",
      "H Dương Minh Châu",
      "Dương Minh Châu",
      "Duong Minh Chau"
    ]
  },
  {
    "district_id": 1863,
    "district_name": "Huyện Tân Châu",
    "province_id": 240,
    "v3_province_id": 1000018,
    "code": "4603",
    "name_extensions": [
      "Huyện Tân Châu",
      "H.Tân Châu",
      "H Tân Châu",
      "Tân Châu",
      "Tan Chau"
    ]
  },
  {
    "district_id": 1862,
    "district_name": "Huyện Tân Biên",
    "province_id": 240,
    "v3_province_id": 1000018,
    "code": "4602",
    "name_extensions": [
      "Huyện Tân Biên",
      "H.Tân Biên",
      "H Tân Biên",
      "Tân Biên",
      "Tan Bien"
    ]
  },
  {
    "district_id": 1721,
    "district_name": "Thị xã Hòa Thành",
    "province_id": 240,
    "v3_province_id": 1000018,
    "code": "4606",
    "name_extensions": [
      "Huyện Hòa Thành",
      "H.Hòa Thành",
      "H Hòa Thành",
      "Hòa Thành",
      "Hoa Thanh"
    ]
  },
  {
    "district_id": 1720,
    "district_name": "Huyện Châu Thành",
    "province_id": 240,
    "v3_province_id": 1000018,
    "code": "4605",
    "name_extensions": [
      "Huyện Châu Thành",
      "H.Châu Thành",
      "H Châu Thành",
      "Châu Thành",
      "Chau Thanh"
    ]
  },
  {
    "district_id": 1626,
    "district_name": "Thành phố Tây Ninh",
    "province_id": 240,
    "v3_province_id": 1000018,
    "code": "4601",
    "name_extensions": [
      "Thành phố Tây Ninh",
      "TP.Tây Ninh",
      "TP Tây Ninh",
      "Tây Ninh",
      "Tay Ninh"
    ]
  },
  {
    "district_id": 2137,
    "district_name": "Huyện Hải Lăng",
    "province_id": 238,
    "v3_province_id": 1000017,
    "code": "3207",
    "name_extensions": [
      "Huyện Hải Lăng",
      "H.Hải Lăng",
      "H Hải Lăng",
      "Hải Lăng",
      "Hai Lang"
    ]
  },
  {
    "district_id": 2110,
    "district_name": "Huyện đảo Cồn Cỏ",
    "province_id": 238,
    "v3_province_id": 1000017,
    "code": "3210",
    "name_extensions": [
      "Huyện đảo Cồn Cỏ",
      "Huyện Cồn Cỏ",
      "Cồn Cỏ",
      "Con Co",
      "Huyen Con Co"
    ]
  },
  {
    "district_id": 2105,
    "district_name": "Huyện Đa Krông",
    "province_id": 238,
    "v3_province_id": 1000017,
    "code": "3209",
    "name_extensions": [
      "Huyện Đa Krông",
      "H.Đa Krông",
      "H Đa Krông",
      "Đa Krông",
      "Da Krong"
    ]
  },
  {
    "district_id": 2040,
    "district_name": "Huyện Triệu Phong",
    "province_id": 238,
    "v3_province_id": 1000017,
    "code": "3206",
    "name_extensions": [
      "Huyện Triệu Phong",
      "H.Triệu Phong",
      "H Triệu Phong",
      "Triệu Phong",
      "Trieu Phong"
    ]
  },
  {
    "district_id": 1936,
    "district_name": "Huyện Gio Linh",
    "province_id": 238,
    "v3_province_id": 1000017,
    "code": "3204",
    "name_extensions": [
      "Huyện Gio Linh",
      "H.Gio Linh",
      "H Gio Linh",
      "Gio Linh",
      "Huyen Gio Linh"
    ]
  },
  {
    "district_id": 1903,
    "district_name": "Huyện Cam Lộ",
    "province_id": 238,
    "v3_province_id": 1000017,
    "code": "3205",
    "name_extensions": [
      "Huyện Cam Lộ",
      "H.Cam Lộ",
      "H Cam Lộ",
      "Cam Lộ",
      "Cam Lo"
    ]
  },
  {
    "district_id": 1861,
    "district_name": "Huyện Vĩnh Linh",
    "province_id": 238,
    "v3_province_id": 1000017,
    "code": "3203",
    "name_extensions": [
      "Huyện Vĩnh Linh",
      "H.Vĩnh Linh",
      "H Vĩnh Linh",
      "Vĩnh Linh",
      "Vinh Linh"
    ]
  },
  {
    "district_id": 1860,
    "district_name": "Huyện Hướng Hóa",
    "province_id": 238,
    "v3_province_id": 1000017,
    "code": "3208",
    "name_extensions": [
      "Huyện Hướng Hóa",
      "H.Hướng Hóa",
      "H Hướng Hóa",
      "Hướng Hóa",
      "Huong Hoa"
    ]
  },
  {
    "district_id": 1621,
    "district_name": "Thị xã Quảng Trị",
    "province_id": 238,
    "v3_province_id": 1000017,
    "code": "3202",
    "name_extensions": [
      "Thị xã Quảng Trị",
      "TX.Quảng Trị",
      "TX Quảng Trị",
      "Quảng Trị",
      "Quang Tri"
    ]
  },
  {
    "district_id": 1620,
    "district_name": "Thành phố Đông Hà",
    "province_id": 238,
    "v3_province_id": 1000017,
    "code": "3201",
    "name_extensions": [
      "Thành phố Đông Hà",
      "TP.Đông Hà",
      "TP Đông Hà",
      "Đông Hà",
      "Dong Ha"
    ]
  },
  {
    "district_id": 3327,
    "district_name": "Huyện Yên Mô",
    "province_id": 233,
    "v3_province_id": 1000016,
    "code": "2706",
    "name_extensions": [
      "Huyện Yên Mô",
      "H.Yên Mô",
      "H Yên Mô",
      "Yên Mô",
      "Yen Mo"
    ]
  },
  {
    "district_id": 3247,
    "district_name": "Huyện Nho Quan",
    "province_id": 233,
    "v3_province_id": 1000016,
    "code": "2703",
    "name_extensions": [
      "Huyện Nho Quan",
      "H.Nho Quan",
      "H Nho Quan",
      "Nho Quan",
      "Huyen Nho Quan"
    ]
  },
  {
    "district_id": 3205,
    "district_name": "Huyện Kim Sơn",
    "province_id": 233,
    "v3_province_id": 1000016,
    "code": "2707",
    "name_extensions": [
      "Huyện Kim Sơn",
      "H.Kim Sơn",
      "H Kim Sơn",
      "Kim Sơn",
      "Kim Son"
    ]
  },
  {
    "district_id": 3191,
    "district_name": "Huyện Gia Viễn",
    "province_id": 233,
    "v3_province_id": 1000016,
    "code": "2704",
    "name_extensions": [
      "Huyện Gia Viễn",
      "H.Gia Viễn",
      "H Gia Viễn",
      "Gia Viễn",
      "Gia Vien"
    ]
  },
  {
    "district_id": 1944,
    "district_name": "Huyện Hoa Lư",
    "province_id": 233,
    "v3_province_id": 1000016,
    "code": "2705",
    "name_extensions": [
      "Huyện Hoa Lư",
      "H.Hoa Lư",
      "H Hoa Lư",
      "Hoa Lư",
      "Hoa Lu"
    ]
  },
  {
    "district_id": 1714,
    "district_name": "Huyện Yên Khánh",
    "province_id": 233,
    "v3_province_id": 1000016,
    "code": "2708",
    "name_extensions": [
      "Huyện Yên Khánh",
      "H.Yên Khánh",
      "H Yên Khánh",
      "Yên Khánh",
      "Yen Khanh"
    ]
  },
  {
    "district_id": 1713,
    "district_name": "Thành phố Tam Điệp",
    "province_id": 233,
    "v3_province_id": 1000016,
    "code": "2702",
    "name_extensions": [
      "Thị xã Tam Điệp",
      "Thành Phố Tam Điệp",
      "TX.Tam Điệp",
      "TX Tam Điệp",
      "Tam Điệp"
    ]
  },
  {
    "district_id": 1615,
    "district_name": "Thành phố Ninh Bình",
    "province_id": 233,
    "v3_province_id": 1000016,
    "code": "2701",
    "name_extensions": [
      "Thành phố Ninh Bình",
      "TP.Ninh Bình",
      "TP Ninh Bình",
      "Ninh Bình",
      "Ninh Binh"
    ]
  },
  {
    "district_id": 3290,
    "district_name": "Huyện Thanh Ba",
    "province_id": 229,
    "v3_province_id": 1000015,
    "code": "1504",
    "name_extensions": [
      "Huyện Thanh Ba",
      "H.Thanh Ba",
      "H Thanh Ba",
      "Thanh Ba",
      "Huyen Thanh Ba"
    ]
  },
  {
    "district_id": 3272,
    "district_name": "Huyện Tam Nông",
    "province_id": 229,
    "v3_province_id": 1000015,
    "code": "1511",
    "name_extensions": [
      "Huyện Tam Nông",
      "H.Tam Nông",
      "H Tam Nông",
      "Tam Nông",
      "Tam Nong"
    ]
  },
  {
    "district_id": 2268,
    "district_name": "Huyện Yên Lập",
    "province_id": 229,
    "v3_province_id": 1000015,
    "code": "1507",
    "name_extensions": [
      "Huyện Yên Lập",
      "H.Yên Lập",
      "H Yên Lập",
      "Yên Lập",
      "Yen Lap"
    ]
  },
  {
    "district_id": 2237,
    "district_name": "Huyện Thanh Thủy",
    "province_id": 229,
    "v3_province_id": 1000015,
    "code": "1512",
    "name_extensions": [
      "Huyện Thanh Thủy",
      "H.Thanh Thủy",
      "H Thanh Thủy",
      "Thanh Thủy",
      "Thanh Thuy"
    ]
  },
  {
    "district_id": 2064,
    "district_name": "Thị xã Phú Thọ",
    "province_id": 229,
    "v3_province_id": 1000015,
    "code": "1502",
    "name_extensions": [
      "Thị xã Phú Thọ",
      "Thi Xã Phú Thọ",
      "TX.Phú Thọ",
      "TX Phú Thọ",
      "Phú Thọ"
    ]
  },
  {
    "district_id": 2029,
    "district_name": "Huyện Thanh Sơn",
    "province_id": 229,
    "v3_province_id": 1000015,
    "code": "1508",
    "name_extensions": [
      "Huyện Thanh Sơn",
      "H.Thanh Sơn",
      "H Thanh Sơn",
      "Thanh Sơn",
      "Thanh Son"
    ]
  },
  {
    "district_id": 2015,
    "district_name": "Huyện Tân Sơn",
    "province_id": 229,
    "v3_province_id": 1000015,
    "code": "1513",
    "name_extensions": [
      "Huyện Tân Sơn",
      "H.Tân Sơn",
      "H Tân Sơn",
      "Tân Sơn",
      "Tan Son"
    ]
  },
  {
    "district_id": 1994,
    "district_name": "Huyện Phù Ninh",
    "province_id": 229,
    "v3_province_id": 1000015,
    "code": "1509",
    "name_extensions": [
      "Huyện Phù Ninh",
      "H.Phù Ninh",
      "H Phù Ninh",
      "Phù Ninh",
      "Phu Ninh"
    ]
  },
  {
    "district_id": 1959,
    "district_name": "Huyện Lâm Thao",
    "province_id": 229,
    "v3_province_id": 1000015,
    "code": "1510",
    "name_extensions": [
      "Huyện Lâm Thao",
      "H.Lâm Thao",
      "H Lâm Thao",
      "Lâm Thao",
      "Lam Thao"
    ]
  },
  {
    "district_id": 1938,
    "district_name": "Huyện Hạ Hòa",
    "province_id": 229,
    "v3_province_id": 1000015,
    "code": "1505",
    "name_extensions": [
      "Huyện Hạ Hòa",
      "H.Hạ Hòa",
      "H Hạ Hòa",
      "Hạ Hòa",
      "Ha Hoa"
    ]
  },
  {
    "district_id": 1925,
    "district_name": "Huyện Đoan Hùng",
    "province_id": 229,
    "v3_province_id": 1000015,
    "code": "1503",
    "name_extensions": [
      "Huyện Đoan Hùng",
      "H.Đoan Hùng",
      "H Đoan Hùng",
      "Đoan Hùng",
      "Doan Hung"
    ]
  },
  {
    "district_id": 1905,
    "district_name": "Huyện Cẩm Khê",
    "province_id": 229,
    "v3_province_id": 1000015,
    "code": "1506",
    "name_extensions": [
      "Huyện Cẩm Khê",
      "H.Cẩm Khê",
      "H Cẩm Khê",
      "Cẩm Khê",
      "Cam Khe"
    ]
  },
  {
    "district_id": 1602,
    "district_name": "Thành phố Việt Trì",
    "province_id": 229,
    "v3_province_id": 1000015,
    "code": "1501",
    "name_extensions": [
      "Thành phố Việt Trì",
      "TP.Việt Trì",
      "TP Việt Trì",
      "Việt Trì",
      "Viet Tri"
    ]
  },
  {
    "district_id": 3267,
    "district_name": "Huyện Sơn Dương",
    "province_id": 228,
    "v3_province_id": 1000014,
    "code": "0907",
    "name_extensions": [
      "Huyện Sơn Dương",
      "H.Sơn Dương",
      "H Sơn Dương",
      "Sơn Dương",
      "Son Duong"
    ]
  },
  {
    "district_id": 3157,
    "district_name": "Huyện Chiêm Hóa",
    "province_id": 228,
    "v3_province_id": 1000014,
    "code": "0904",
    "name_extensions": [
      "Huyện Chiêm Hóa",
      "H.Chiêm Hóa",
      "H Chiêm Hóa",
      "Chiêm Hóa",
      "Chiem Hoa"
    ]
  },
  {
    "district_id": 1982,
    "district_name": "Huyện Na Hang",
    "province_id": 228,
    "v3_province_id": 1000014,
    "code": "0903",
    "name_extensions": [
      "Huyện Na Hang",
      "Huyện Nà Hang",
      "H.Na Hang",
      "H Na Hang",
      "Na Hang"
    ]
  },
  {
    "district_id": 1957,
    "district_name": "Huyện Lâm Bình",
    "province_id": 228,
    "v3_province_id": 1000014,
    "code": "0902",
    "name_extensions": [
      "Huyện Lâm Bình",
      "H.Lâm Bình",
      "H Lâm Bình",
      "Lâm Bình",
      "Lam Binh"
    ]
  },
  {
    "district_id": 1941,
    "district_name": "Huyện Hàm Yên",
    "province_id": 228,
    "v3_province_id": 1000014,
    "code": "0905",
    "name_extensions": [
      "Huyện Hàm Yên",
      "H.Hàm Yên",
      "H Hàm Yên",
      "Hàm Yên",
      "Ham Yen"
    ]
  },
  {
    "district_id": 1745,
    "district_name": "Huyện Yên Sơn",
    "province_id": 228,
    "v3_province_id": 1000014,
    "code": "0906",
    "name_extensions": [
      "Huyện Yên Sơn",
      "H.Yên Sơn",
      "H Yên Sơn",
      "Yên Sơn",
      "Yen Son"
    ]
  },
  {
    "district_id": 1601,
    "district_name": "Thành phố Tuyên Quang",
    "province_id": 228,
    "v3_province_id": 1000014,
    "code": "0901",
    "name_extensions": [
      "Thành phố Tuyên Quang",
      "TP.Tuyên Quang",
      "TP Tuyên Quang",
      "Tuyên Quang",
      "Tuyen Quang"
    ]
  },
  {
    "district_id": 1758,
    "district_name": "Huyện Châu Phú",
    "province_id": 217,
    "v3_province_id": 1000013,
    "code": "5108",
    "name_extensions": [
      "Huyện Châu Phú",
      "H.Châu Phú",
      "H Châu Phú",
      "Châu Phú",
      "Chau Phu"
    ]
  },
  {
    "district_id": 1757,
    "district_name": "Huyện Chợ Mới",
    "province_id": 217,
    "v3_province_id": 1000013,
    "code": "5109",
    "name_extensions": [
      "Huyện Chợ Mới",
      "H.Chợ Mới",
      "H Chợ Mới",
      "Chợ Mới",
      "Cho Moi"
    ]
  },
  {
    "district_id": 1756,
    "district_name": "Huyện Phú Tân",
    "province_id": 217,
    "v3_province_id": 1000013,
    "code": "5105",
    "name_extensions": [
      "Huyện Phú Tân",
      "H.Phú Tân",
      "H Phú Tân",
      "Phú Tân",
      "Phu Tan"
    ]
  },
  {
    "district_id": 1755,
    "district_name": "Thị Xã Tân Châu",
    "province_id": 217,
    "v3_province_id": 1000013,
    "code": "5104",
    "name_extensions": [
      "Huyện Tân Châu",
      "H.Tân Châu",
      "H Tân Châu",
      "Tân Châu",
      "Tan Chau"
    ]
  },
  {
    "district_id": 1754,
    "district_name": "Huyện An Phú",
    "province_id": 217,
    "v3_province_id": 1000013,
    "code": "5103",
    "name_extensions": [
      "Huyện An Phú",
      "H.An Phú",
      "H An Phú",
      "An Phú",
      "An Phu"
    ]
  },
  {
    "district_id": 1753,
    "district_name": "Thành phố Châu Đốc",
    "province_id": 217,
    "v3_province_id": 1000013,
    "code": "5102",
    "name_extensions": [
      "Thành phố Châu Đốc",
      "TP.Châu Đốc",
      "TP Châu Đốc",
      "Châu Đốc",
      "Chau Doc"
    ]
  },
  {
    "district_id": 1752,
    "district_name": "Huyện Tịnh Biên",
    "province_id": 217,
    "v3_province_id": 1000013,
    "code": "5106",
    "name_extensions": [
      "Huyện Tịnh Biên",
      "H.Tịnh Biên",
      "H Tịnh Biên",
      "Tịnh Biên",
      "Tinh Bien"
    ]
  },
  {
    "district_id": 1751,
    "district_name": "Huyện Tri Tôn",
    "province_id": 217,
    "v3_province_id": 1000013,
    "code": "5107",
    "name_extensions": [
      "Huyện Tri Tôn",
      "H.Tri Tôn",
      "H Tri Tôn",
      "Tri Tôn",
      "Tri Ton"
    ]
  },
  {
    "district_id": 1750,
    "district_name": "Huyện Thoại Sơn",
    "province_id": 217,
    "v3_province_id": 1000013,
    "code": "5111",
    "name_extensions": [
      "Huyện Thoại Sơn",
      "H.Thoại Sơn",
      "H Thoại Sơn",
      "Thoại Sơn",
      "Thoai Son"
    ]
  },
  {
    "district_id": 1718,
    "district_name": "Huyện Châu Thành",
    "province_id": 217,
    "v3_province_id": 1000013,
    "code": "5110",
    "name_extensions": [
      "Huyện Châu Thành",
      "H.Châu Thành",
      "H Châu Thành",
      "Châu Thành",
      "Chau Thanh"
    ]
  },
  {
    "district_id": 1566,
    "district_name": "Thành phố Long Xuyên",
    "province_id": 217,
    "v3_province_id": 1000013,
    "code": "5101",
    "name_extensions": [
      "Thành phố Long Xuyên",
      "TP.Long Xuyên",
      "TP Long Xuyên",
      "Long Xuyên",
      "Long Xuyen"
    ]
  },
  {
    "district_id": 3696,
    "district_name": "Huyện Hồng Ngự",
    "province_id": 216,
    "v3_province_id": 1000012,
    "name_extensions": [
      "huyện hồng ngự",
      "hongngu"
    ]
  },
  {
    "district_id": 3200,
    "district_name": "Huyện Hồng Ngự",
    "province_id": 216,
    "v3_province_id": 1000012,
    "code": "5004",
    "name_extensions": [
      "Huyện Hồng Ngự",
      "H.Hồng Ngự",
      "H Hồng Ngự",
      "Hồng Ngự",
      "Hong Ngu"
    ]
  },
  {
    "district_id": 3155,
    "district_name": "Huyện Châu Thành",
    "province_id": 216,
    "v3_province_id": 1000012,
    "code": "5011",
    "name_extensions": [
      "Huyện Châu Thành",
      "H.Châu Thành",
      "H Châu Thành",
      "Châu Thành",
      "Chau Thanh"
    ]
  },
  {
    "district_id": 2059,
    "district_name": "Thành Phố Hồng Ngự",
    "province_id": 216,
    "v3_province_id": 1000012,
    "code": "5012",
    "name_extensions": [
      "Hồng Ngự",
      "Hong Ngu",
      "hongngu",
      "TP Hồng Ngự",
      "Thành phố Hồng Ngự"
    ]
  },
  {
    "district_id": 2030,
    "district_name": "Huyện Tháp Mười",
    "province_id": 216,
    "v3_province_id": 1000012,
    "code": "5009",
    "name_extensions": [
      "Huyện Tháp Mười",
      "H.Tháp Mười",
      "H Tháp Mười",
      "Tháp Mười",
      "Thap Muoi"
    ]
  },
  {
    "district_id": 2026,
    "district_name": "Huyện Thanh Bình",
    "province_id": 216,
    "v3_province_id": 1000012,
    "code": "5006",
    "name_extensions": [
      "Huyện Thanh Bình",
      "H.Thanh Bình",
      "H Thanh Bình",
      "Thanh Bình",
      "Thanh Binh"
    ]
  },
  {
    "district_id": 2013,
    "district_name": "Huyện Tân Hồng",
    "province_id": 216,
    "v3_province_id": 1000012,
    "code": "5003",
    "name_extensions": [
      "Huyện Tân Hồng",
      "H.Tân Hồng",
      "H Tân Hồng",
      "Tân Hồng",
      "Tan Hong"
    ]
  },
  {
    "district_id": 2011,
    "district_name": "Huyện Tam Nông",
    "province_id": 216,
    "v3_province_id": 1000012,
    "code": "5005",
    "name_extensions": [
      "Huyện Tam Nông",
      "H.Tam Nông",
      "H Tam Nông",
      "Tam Nông",
      "Tam Nong"
    ]
  },
  {
    "district_id": 1961,
    "district_name": "Huyện Lấp Vò",
    "province_id": 216,
    "v3_province_id": 1000012,
    "code": "5008",
    "name_extensions": [
      "Huyện Lấp Vò",
      "H.Lấp Vò",
      "H Lấp Vò",
      "Lấp Vò",
      "Lap Vo"
    ]
  },
  {
    "district_id": 1725,
    "district_name": "Huyện Lai Vung",
    "province_id": 216,
    "v3_province_id": 1000012,
    "code": "5010",
    "name_extensions": [
      "Huyện Lai Vung",
      "H.Lai Vung",
      "H Lai Vung",
      "Lai Vung",
      "Huyen Lai Vung"
    ]
  },
  {
    "district_id": 1724,
    "district_name": "Huyện Cao Lãnh",
    "province_id": 216,
    "v3_province_id": 1000012,
    "code": "5007",
    "name_extensions": [
      "Huyện Cao Lãnh",
      "H.Cao Lãnh",
      "H Cao Lãnh",
      "Huyen Cao Lanh",
      "Cao Lanh"
    ]
  },
  {
    "district_id": 1668,
    "district_name": "Thành phố Sa Đéc",
    "province_id": 216,
    "v3_province_id": 1000012,
    "code": "5002",
    "name_extensions": [
      "Thành phố Sa Đéc",
      "TP.Sa Đéc",
      "TP Sa Đéc",
      "Sa Đéc",
      "Sa Dec"
    ]
  },
  {
    "district_id": 1564,
    "district_name": "Thành phố Cao Lãnh",
    "province_id": 216,
    "v3_province_id": 1000012,
    "code": "5001",
    "name_extensions": [
      "Thành phố Cao Lãnh",
      "TP.Cao Lãnh",
      "TP Cao Lãnh",
      "Thanh pho Cao Lanh",
      "caolanh"
    ]
  },
  {
    "district_id": 2263,
    "district_name": "Huyện Vũng Liêm",
    "province_id": 215,
    "v3_province_id": 1000011,
    "code": "5707",
    "name_extensions": [
      "Huyện Vũng Liêm",
      "H.Vũng Liêm",
      "H Vũng Liêm",
      "Vũng Liêm",
      "Vung Liem"
    ]
  },
  {
    "district_id": 2164,
    "district_name": "Huyện Mang Thít",
    "province_id": 215,
    "v3_province_id": 1000011,
    "code": "5703",
    "name_extensions": [
      "Huyện Mang Thít",
      "H.Mang Thít",
      "H Mang Thít",
      "Mang Thít",
      "Mang Thit"
    ]
  },
  {
    "district_id": 2081,
    "district_name": "Huyện Bình Tân",
    "province_id": 215,
    "v3_province_id": 1000011,
    "code": "5708",
    "name_extensions": [
      "Huyện Bình Tân",
      "H.Bình Tân",
      "H Bình Tân",
      "Bình Tân",
      "Binh Tan"
    ]
  },
  {
    "district_id": 2054,
    "district_name": "Thị xã Bình Minh",
    "province_id": 215,
    "v3_province_id": 1000011,
    "code": "5704",
    "name_extensions": [
      "Thị xã Bình Minh",
      "TX.Bình Minh",
      "TX Bình Minh",
      "Bình Minh",
      "Binh Minh"
    ]
  },
  {
    "district_id": 2034,
    "district_name": "Huyện Trà Ôn",
    "province_id": 215,
    "v3_province_id": 1000011,
    "code": "5706",
    "name_extensions": [
      "Huyện Trà Ôn",
      "H.Trà Ôn",
      "H Trà Ôn",
      "Trà Ôn",
      "Tra On"
    ]
  },
  {
    "district_id": 2008,
    "district_name": "Huyện Tam Bình",
    "province_id": 215,
    "v3_province_id": 1000011,
    "code": "5705",
    "name_extensions": [
      "Huyện Tam Bình",
      "H.Tam Bình",
      "H Tam Bình",
      "Tam Bình",
      "Tam Binh"
    ]
  },
  {
    "district_id": 1962,
    "district_name": "Huyện Long Hồ",
    "province_id": 215,
    "v3_province_id": 1000011,
    "code": "5702",
    "name_extensions": [
      "Huyện Long Hồ",
      "H.Long Hồ",
      "H Long Hồ",
      "Long Hồ",
      "Long Ho"
    ]
  },
  {
    "district_id": 1562,
    "district_name": "Thành phố Vĩnh Long",
    "province_id": 215,
    "v3_province_id": 1000011,
    "code": "5701",
    "name_extensions": [
      "Thành phố Vĩnh Long",
      "TP.Vĩnh Long",
      "TP Vĩnh Long",
      "Vĩnh Long",
      "Vinh Long"
    ]
  },
  {
    "district_id": 3418,
    "district_name": "Huyện M Đrắk",
    "province_id": 210,
    "v3_province_id": 1000010,
    "code": "4009",
    "name_extensions": [
      "Huyện M Đrắk",
      "Huyện M'Đrắk",
      "H.M Đrắk",
      "H.M'Đrắk",
      "H M Đrắk"
    ]
  },
  {
    "district_id": 3217,
    "district_name": "Huyện Lắk",
    "province_id": 210,
    "v3_province_id": 1000010,
    "code": "4012",
    "name_extensions": [
      "Huyện Lắk",
      "H.Lắk",
      "H Lắk",
      "Lắk",
      "Lak"
    ]
  },
  {
    "district_id": 3153,
    "district_name": "Huyện Cư Kuin",
    "province_id": 210,
    "v3_province_id": 1000010,
    "code": "4014",
    "name_extensions": [
      "Huyện Cư Kuin",
      "H.Cư Kuin",
      "H Cư Kuin",
      "Cư Kuin",
      "Cu Kuin"
    ]
  },
  {
    "district_id": 2150,
    "district_name": "Huyện Krông Búk",
    "province_id": 210,
    "v3_province_id": 1000010,
    "code": "4003",
    "name_extensions": [
      "Huyện Krông Búk",
      "H.Krông Búk",
      "H Krông Búk",
      "Krông Búk",
      "Krong Buk"
    ]
  },
  {
    "district_id": 2131,
    "district_name": "Huyện Ea Súp",
    "province_id": 210,
    "v3_province_id": 1000010,
    "code": "4005",
    "name_extensions": [
      "Huyện Ea Súp",
      "H.Ea Súp",
      "H Ea Súp",
      "Ea Súp",
      "Ea Sup"
    ]
  },
  {
    "district_id": 1954,
    "district_name": "Huyện Krông Pắc",
    "province_id": 210,
    "v3_province_id": 1000010,
    "code": "4007",
    "name_extensions": [
      "Huyện Krông Pắc",
      "Huyện Krông Pắk",
      "H.Krông Pắc",
      "H.Krông Pắk",
      "H Krông Pắc"
    ]
  },
  {
    "district_id": 1931,
    "district_name": "Huyện Ea Kar",
    "province_id": 210,
    "v3_province_id": 1000010,
    "code": "4008",
    "name_extensions": [
      "Huyện Ea Kar",
      "H.Ea Kar",
      "H Ea Kar",
      "Ea Kar",
      "Huyen Ea Kar"
    ]
  },
  {
    "district_id": 1884,
    "district_name": "Huyện Krông Ana",
    "province_id": 210,
    "v3_province_id": 1000010,
    "code": "4010",
    "name_extensions": [
      "Huyện Krông Ana",
      "Huyện Krông A Na",
      "H.Krông Ana",
      "H.Krông Ana",
      "H Krông A Na"
    ]
  },
  {
    "district_id": 1789,
    "district_name": "Huyện Krông Bông",
    "province_id": 210,
    "v3_province_id": 1000010,
    "code": "4011",
    "name_extensions": [
      "Huyện Krông Bông",
      "H.Krông Bông",
      "H Krông Bông",
      "Krông Bông",
      "Krong Bong"
    ]
  },
  {
    "district_id": 1788,
    "district_name": "Thị xã Buôn Hồ",
    "province_id": 210,
    "v3_province_id": 1000010,
    "code": "4015",
    "name_extensions": [
      "Thị xã Buôn Hồ",
      "TX.Buôn Hồ",
      "TX Buôn Hồ",
      "Buôn Hồ",
      "Buon Ho"
    ]
  },
  {
    "district_id": 1787,
    "district_name": "Huyện Krông Năng",
    "province_id": 210,
    "v3_province_id": 1000010,
    "code": "4004",
    "name_extensions": [
      "Huyện Krông Năng",
      "H.Krông Năng",
      "H Krông Năng",
      "Krông Năng",
      "Krong Nang"
    ]
  },
  {
    "district_id": 1786,
    "district_name": "Huyện Ea H leo",
    "province_id": 210,
    "v3_province_id": 1000010,
    "code": "4002",
    "name_extensions": [
      "Huyện Ea H leo",
      "Huyện Ea H'Leo",
      "H.Ea H leo",
      "H Ea H leo",
      "Ea H leo"
    ]
  },
  {
    "district_id": 1785,
    "district_name": "Huyện Cư M gar",
    "province_id": 210,
    "v3_province_id": 1000010,
    "code": "4006",
    "name_extensions": [
      "Huyện Cư M gar",
      "Huyện Cư M'Gar",
      "H.Cư M gar",
      "H Cư M gar",
      "Cư M gar"
    ]
  },
  {
    "district_id": 1784,
    "district_name": "Huyện Buôn Ðôn",
    "province_id": 210,
    "v3_province_id": 1000010,
    "code": "4013",
    "name_extensions": [
      "Huyện Buôn Đôn",
      "Huyện Buôn Ðôn",
      "Huyện Buôn Ðôn",
      "H.Buôn Ðôn",
      "H Buôn Ðôn"
    ]
  },
  {
    "district_id": 1552,
    "district_name": "Thành phố Buôn Ma Thuột",
    "province_id": 210,
    "v3_province_id": 1000010,
    "code": "4001",
    "name_extensions": [
      "Thành phố Buôn Ma Thuột",
      "TP.Buôn Ma Thuột",
      "TP Buôn Ma Thuột",
      "Buôn Ma Thuột",
      "Buon Ma Thuot"
    ]
  },
  {
    "district_id": 3160,
    "district_name": "Huyện Di Linh",
    "province_id": 209,
    "v3_province_id": 1000009,
    "code": "4204",
    "name_extensions": [
      "Huyện Di Linh",
      "H.Di Linh",
      "H Di Linh",
      "Di Linh",
      "Huyen Di Linh"
    ]
  },
  {
    "district_id": 3146,
    "district_name": "Huyện Cát Tiên",
    "province_id": 209,
    "v3_province_id": 1000009,
    "code": "4209",
    "name_extensions": [
      "Huyện Cát Tiên",
      "H.Cát Tiên",
      "H Cát Tiên",
      "Cát Tiên",
      "Cat Tien"
    ]
  },
  {
    "district_id": 2106,
    "district_name": "Huyện Đạ Tẻh",
    "province_id": 209,
    "v3_province_id": 1000009,
    "code": "4208",
    "name_extensions": [
      "Huyện Đạ Tẻh",
      "H.Đạ Tẻh",
      "H Đạ Tẻh",
      "Đạ Tẻh",
      "Da Teh"
    ]
  },
  {
    "district_id": 2104,
    "district_name": "Huyện Đạ Huoai",
    "province_id": 209,
    "v3_province_id": 1000009,
    "code": "4207",
    "name_extensions": [
      "Huyện Đạ Huoai",
      "H.Đạ Huoai",
      "H Đạ Huoai",
      "Đạ Huoai",
      "Da Huoai"
    ]
  },
  {
    "district_id": 1958,
    "district_name": "Huyện Lâm Hà",
    "province_id": 209,
    "v3_province_id": 1000009,
    "code": "4210",
    "name_extensions": [
      "Huyện Lâm Hà",
      "H.Lâm Hà",
      "H Lâm Hà",
      "Lâm Hà",
      "Lam Ha"
    ]
  },
  {
    "district_id": 1956,
    "district_name": "Huyện Lạc Dương",
    "province_id": 209,
    "v3_province_id": 1000009,
    "code": "4206",
    "name_extensions": [
      "Huyện Lạc Dương",
      "H.Lạc Dương",
      "H Lạc Dương",
      "Lạc Dương",
      "Lac Duong"
    ]
  },
  {
    "district_id": 1919,
    "district_name": "Huyện Đam Rông",
    "province_id": 209,
    "v3_province_id": 1000009,
    "code": "4212",
    "name_extensions": [
      "Huyện Đam Rông",
      "H.Đam Rông",
      "H Đam Rông",
      "Đam Rông",
      "Dam Rong"
    ]
  },
  {
    "district_id": 1839,
    "district_name": "Huyện Bảo Lâm",
    "province_id": 209,
    "v3_province_id": 1000009,
    "code": "4211",
    "name_extensions": [
      "Huyện Bảo Lâm",
      "H.Bảo Lâm",
      "H Bảo Lâm",
      "Bảo Lâm",
      "Bao Lam"
    ]
  },
  {
    "district_id": 1838,
    "district_name": "Thành phố Bảo Lộc",
    "province_id": 209,
    "v3_province_id": 1000009,
    "code": "4202",
    "name_extensions": [
      "Thành phố Bảo Lộc",
      "TP.Bảo Lộc",
      "TP Bảo Lộc",
      "Bảo Lộc",
      "Bao Loc"
    ]
  },
  {
    "district_id": 1837,
    "district_name": "Huyện Đức Trọng",
    "province_id": 209,
    "v3_province_id": 1000009,
    "code": "4203",
    "name_extensions": [
      "Huyện Đức Trọng",
      "H.Đức Trọng",
      "H Đức Trọng",
      "Đức Trọng",
      "Duc Trong"
    ]
  },
  {
    "district_id": 1836,
    "district_name": "Huyện Đơn Dương",
    "province_id": 209,
    "v3_province_id": 1000009,
    "code": "4205",
    "name_extensions": [
      "Huyện Đơn Dương",
      "H.Đơn Dương",
      "H Đơn Dương",
      "Đơn Dương",
      "Don Duong"
    ]
  },
  {
    "district_id": 1550,
    "district_name": "Thành phố Đà Lạt",
    "province_id": 209,
    "v3_province_id": 1000009,
    "code": "4201",
    "name_extensions": [
      "Thành phố Đà Lạt",
      "TP.Đà Lạt",
      "TP Đà Lạt",
      "Đà Lạt",
      "Da Lat"
    ]
  },
  {
    "district_id": 3213,
    "district_name": "Huyện Khánh Vĩnh",
    "province_id": 208,
    "v3_province_id": 1000008,
    "code": "4105",
    "name_extensions": [
      "Huyện Khánh Vĩnh",
      "H.Khánh Vĩnh",
      "H Khánh Vĩnh",
      "Khánh Vĩnh",
      "Khanh Vinh"
    ]
  },
  {
    "district_id": 3212,
    "district_name": "Huyện Khánh Sơn",
    "province_id": 208,
    "v3_province_id": 1000008,
    "code": "4107",
    "name_extensions": [
      "Huyện Khánh Sơn",
      "H.Khánh Sơn",
      "H Khánh Sơn",
      "Khánh Sơn",
      "Khanh Son"
    ]
  },
  {
    "district_id": 2117,
    "district_name": "Huyện đảo Trường Sa",
    "province_id": 208,
    "v3_province_id": 1000008,
    "code": "4108",
    "name_extensions": [
      "Huyện đảo Trường Sa",
      "Huyện Đảo Trường Sa",
      "Huyện Trường Sa",
      "Trường Sa",
      "Truong Sa"
    ]
  },
  {
    "district_id": 2061,
    "district_name": "Thị xã Ninh Hòa",
    "province_id": 208,
    "v3_province_id": 1000008,
    "code": "4103",
    "name_extensions": [
      "Thị xã Ninh Hòa",
      "TX.Ninh Hòa",
      "TX Ninh Hòa",
      "Ninh Hòa",
      "Ninh Hoa"
    ]
  },
  {
    "district_id": 1902,
    "district_name": "Huyện Cam Lâm",
    "province_id": 208,
    "v3_province_id": 1000008,
    "code": "4109",
    "name_extensions": [
      "Huyện Cam Lâm",
      "H.Cam Lâm",
      "H Cam Lâm",
      "Cam Lâm",
      "Cam Lam"
    ]
  },
  {
    "district_id": 1829,
    "district_name": "Huyện Vạn Ninh",
    "province_id": 208,
    "v3_province_id": 1000008,
    "code": "4102",
    "name_extensions": [
      "Huyện Vạn Ninh",
      "H.Vạn Ninh",
      "H Vạn Ninh",
      "Vạn Ninh",
      "Van Ninh"
    ]
  },
  {
    "district_id": 1739,
    "district_name": "Huyện Diên Khánh",
    "province_id": 208,
    "v3_province_id": 1000008,
    "code": "4104",
    "name_extensions": [
      "Huyện Diên Khánh",
      "H.Diên Khánh",
      "H Diên Khánh",
      "Diên Khánh",
      "Dien Khanh"
    ]
  },
  {
    "district_id": 1664,
    "district_name": "Thành phố Cam Ranh",
    "province_id": 208,
    "v3_province_id": 1000008,
    "code": "4106",
    "name_extensions": [
      "Thành phố Cam Ranh",
      "TP.Cam Ranh",
      "TP Cam Ranh",
      "Cam Ranh",
      "Thanh pho Cam Ranh"
    ]
  },
  {
    "district_id": 1548,
    "district_name": "Thành phố Nha Trang",
    "province_id": 208,
    "v3_province_id": 1000008,
    "code": "4101",
    "name_extensions": [
      "Thành phố Nha Trang",
      "TP.Nha Trang",
      "TP Nha Trang",
      "Nha Trang",
      "Thanh pho Nha Trang"
    ]
  },
  {
    "district_id": 2165,
    "district_name": "Huyện Mang Yang",
    "province_id": 207,
    "v3_province_id": 1000007,
    "code": "3803",
    "name_extensions": [
      "Huyện Mang Yang",
      "H.Mang Yang",
      "H Mang Yang",
      "Mang Yang",
      "Huyen Mang Yang"
    ]
  },
  {
    "district_id": 2152,
    "district_name": "Huyện Krông Pa",
    "province_id": 207,
    "v3_province_id": 1000007,
    "code": "3811",
    "name_extensions": [
      "Huyện Krông Pa",
      "H.Krông Pa",
      "H Krông Pa",
      "Krông Pa",
      "Krong Pa"
    ]
  },
  {
    "district_id": 2149,
    "district_name": "Huyện Kông Chro",
    "province_id": 207,
    "v3_province_id": 1000007,
    "code": "3806",
    "name_extensions": [
      "Huyện Kông Chro",
      "H.Kông Chro",
      "H Kông Chro",
      "Kông Chro",
      "Kong Chro"
    ]
  },
  {
    "district_id": 2144,
    "district_name": "Huyện Kbang",
    "province_id": 207,
    "v3_province_id": 1000007,
    "code": "3804",
    "name_extensions": [
      "Huyện Kbang",
      "H.Kbang",
      "H Kbang",
      "Kbang",
      "Huyen Kbang"
    ]
  },
  {
    "district_id": 2119,
    "district_name": "Huyện Đắk Pơ",
    "province_id": 207,
    "v3_province_id": 1000007,
    "code": "3815",
    "name_extensions": [
      "Huyện Đắk Pơ",
      "Huyện Đăk Pơ",
      "H.Đắk Pơ",
      "H Đắk Pơ",
      "Đắk Pơ"
    ]
  },
  {
    "district_id": 2118,
    "district_name": "Huyện Đắk Đoa",
    "province_id": 207,
    "v3_province_id": 1000007,
    "code": "3813",
    "name_extensions": [
      "Huyện Đắk Đoa",
      "Huyện Đăk Đoa",
      "H.Đắk Đoa",
      "H Đắk Đoa",
      "Đắk Đoa"
    ]
  },
  {
    "district_id": 2101,
    "district_name": "Huyện Chư Pưh",
    "province_id": 207,
    "v3_province_id": 1000007,
    "code": "3817",
    "name_extensions": [
      "Huyện Chư Pưh",
      "H.Chư Pưh",
      "H Chư Pưh",
      "Chư Pưh",
      "Chu Puh"
    ]
  },
  {
    "district_id": 1801,
    "district_name": "Huyện Chư Păh",
    "province_id": 207,
    "v3_province_id": 1000007,
    "code": "3802",
    "name_extensions": [
      "Huyện Chư Păh",
      "H.Chư Păh",
      "H Chư Păh",
      "Chư Păh",
      "Chu Pah"
    ]
  },
  {
    "district_id": 1800,
    "district_name": "Thị xã An Khê",
    "province_id": 207,
    "v3_province_id": 1000007,
    "code": "3805",
    "name_extensions": [
      "Thị xã An Khê",
      "TX.An Khê",
      "TX An Khê",
      "An Khê",
      "An Khe"
    ]
  },
  {
    "district_id": 1799,
    "district_name": "Huyện Ia Pa",
    "province_id": 207,
    "v3_province_id": 1000007,
    "code": "3814",
    "name_extensions": [
      "Huyện Ia Pa",
      "H.Ia Pa",
      "H Ia Pa",
      "Ia Pa",
      "Huyen Ia Pa"
    ]
  },
  {
    "district_id": 1798,
    "district_name": "Thị xã Ayun Pa",
    "province_id": 207,
    "v3_province_id": 1000007,
    "code": "3810",
    "name_extensions": [
      "Thị xã Ayun Pa",
      "TX.Ayun Pa",
      "TX Ayun Pa",
      "Ayun Pa",
      "Thi xa Ayun Pa"
    ]
  },
  {
    "district_id": 1797,
    "district_name": "Huyện Phú Thiện",
    "province_id": 207,
    "v3_province_id": 1000007,
    "code": "3816",
    "name_extensions": [
      "Huyện Phú Thiện",
      "H.Phú Thiện",
      "H Phú Thiện",
      "Phú Thiện",
      "Phu Thien"
    ]
  },
  {
    "district_id": 1796,
    "district_name": "Huyện Chư Sê",
    "province_id": 207,
    "v3_province_id": 1000007,
    "code": "3809",
    "name_extensions": [
      "Huyện Chư Sê",
      "H.Chư Sê",
      "H Chư Sê",
      "Chư Sê",
      "Chu Se"
    ]
  },
  {
    "district_id": 1795,
    "district_name": "Huyện Chư Prông",
    "province_id": 207,
    "v3_province_id": 1000007,
    "code": "3808",
    "name_extensions": [
      "Huyện Chư Prông",
      "H.Chư Prông",
      "H Chư Prông",
      "Chư Prông",
      "Chu Prong"
    ]
  },
  {
    "district_id": 1794,
    "district_name": "Huyện Đức Cơ",
    "province_id": 207,
    "v3_province_id": 1000007,
    "code": "3807",
    "name_extensions": [
      "Huyện Đức Cơ",
      "H.Đức Cơ",
      "H Đức Cơ",
      "Đức Cơ",
      "Duc Co"
    ]
  },
  {
    "district_id": 1793,
    "district_name": "Huyện Ia Grai",
    "province_id": 207,
    "v3_province_id": 1000007,
    "code": "3812",
    "name_extensions": [
      "Huyện Ia Grai",
      "H.Ia Grai",
      "H Ia Grai",
      "Ia Grai",
      "Huyen Ia Grai"
    ]
  },
  {
    "district_id": 1546,
    "district_name": "Thành phố Pleiku",
    "province_id": 207,
    "v3_province_id": 1000007,
    "code": "3801",
    "name_extensions": [
      "Thành phố Pleiku",
      "TP.Pleiku",
      "TP Pleiku",
      "Pleiku",
      "Thanh pho Pleiku"
    ]
  },
  {
    "district_id": 2049,
    "district_name": "Huyện Vĩnh Cửu",
    "province_id": 204,
    "v3_province_id": 1000006,
    "code": "4802",
    "name_extensions": [
      "Huyện Vĩnh Cửu",
      "H.Vĩnh Cửu",
      "H Vĩnh Cửu",
      "Vĩnh Cửu",
      "Vinh Cuu"
    ]
  },
  {
    "district_id": 1708,
    "district_name": "Huyện Nhơn Trạch",
    "province_id": 204,
    "v3_province_id": 1000006,
    "code": "4809",
    "name_extensions": [
      "Huyện Nhơn Trạch",
      "H.Nhơn Trạch",
      "H Nhơn Trạch",
      "Nhơn Trạch",
      "Nhon Trach"
    ]
  },
  {
    "district_id": 1705,
    "district_name": "Huyện Thống Nhất",
    "province_id": 204,
    "v3_province_id": 1000006,
    "code": "4805",
    "name_extensions": [
      "Huyện Thống Nhất",
      "H.Thống Nhất",
      "H Thống Nhất",
      "Thống Nhất",
      "Thong Nhat"
    ]
  },
  {
    "district_id": 1704,
    "district_name": "Huyện Xuân Lộc",
    "province_id": 204,
    "v3_province_id": 1000006,
    "code": "4807",
    "name_extensions": [
      "Huyện Xuân Lộc",
      "H.Xuân Lộc",
      "H Xuân Lộc",
      "Xuân Lộc",
      "Xuan Loc"
    ]
  },
  {
    "district_id": 1702,
    "district_name": "Huyện Cẩm Mỹ",
    "province_id": 204,
    "v3_province_id": 1000006,
    "code": "4811",
    "name_extensions": [
      "Huyện Cẩm Mỹ",
      "H.Cẩm Mỹ",
      "H Cẩm Mỹ",
      "Cẩm Mỹ",
      "Cam My"
    ]
  },
  {
    "district_id": 1700,
    "district_name": "Huyện Định Quán",
    "province_id": 204,
    "v3_province_id": 1000006,
    "code": "4804",
    "name_extensions": [
      "Huyện Định Quán",
      "H.Định Quán",
      "H Định Quán",
      "Định Quán",
      "Dinh Quan"
    ]
  },
  {
    "district_id": 1694,
    "district_name": "Huyện Long Thành",
    "province_id": 204,
    "v3_province_id": 1000006,
    "code": "4808",
    "name_extensions": [
      "Huyện Long Thành",
      "H.Long Thành",
      "H Long Thành",
      "Long Thành",
      "Long Thanh"
    ]
  },
  {
    "district_id": 1693,
    "district_name": "Huyện Tân Phú",
    "province_id": 204,
    "v3_province_id": 1000006,
    "code": "4803",
    "name_extensions": [
      "Huyện Tân Phú",
      "H.Tân Phú",
      "H Tân Phú",
      "Tân Phú",
      "Tan Phu"
    ]
  },
  {
    "district_id": 1692,
    "district_name": "Thành phố Long Khánh",
    "province_id": 204,
    "v3_province_id": 1000006,
    "code": "4806",
    "name_extensions": [
      "Thị xã Long Khánh",
      "TX.Long Khánh",
      "TX Long Khánh",
      "Long Khánh",
      "Long Khanh"
    ]
  },
  {
    "district_id": 1691,
    "district_name": "Huyện Trảng Bom",
    "province_id": 204,
    "v3_province_id": 1000006,
    "code": "4810",
    "name_extensions": [
      "Huyện Trảng Bom",
      "H.Trảng Bom",
      "H Trảng Bom",
      "Trảng Bom",
      "Trang Bom"
    ]
  },
  {
    "district_id": 1536,
    "district_name": "Thành phố Biên Hòa",
    "province_id": 204,
    "v3_province_id": 1000006,
    "code": "4801",
    "name_extensions": [
      "Thành phố Biên Hòa",
      "TP.Biên Hòa",
      "TP Biên Hòa",
      "Biên Hòa",
      "Bien Hoa"
    ]
  },
  {
    "district_id": 3317,
    "district_name": "Huyện Vĩnh Thạnh",
    "province_id": 220,
    "v3_province_id": 1000005,
    "code": "5507",
    "name_extensions": [
      "Huyện Vĩnh Thạnh",
      "H.Vĩnh Thạnh",
      "H Vĩnh Thạnh",
      "Vĩnh Thạnh",
      "Vinh Thanh"
    ]
  },
  {
    "district_id": 3300,
    "district_name": "Huyện Thới Lai",
    "province_id": 220,
    "v3_province_id": 1000005,
    "code": "5509",
    "name_extensions": [
      "Huyện Thới Lai",
      "H.Thới Lai",
      "H Thới Lai",
      "Thới Lai",
      "Thoi Lai"
    ]
  },
  {
    "district_id": 3250,
    "district_name": "Huyện Phong Điền",
    "province_id": 220,
    "v3_province_id": 1000005,
    "code": "5505",
    "name_extensions": [
      "Huyện Phong Điền",
      "H.Phong Điền",
      "H Phong Điền",
      "Phong Điền",
      "Phong Dien"
    ]
  },
  {
    "district_id": 3150,
    "district_name": "Huyện Cờ Đỏ",
    "province_id": 220,
    "v3_province_id": 1000005,
    "code": "5506",
    "name_extensions": [
      "Huyện Cờ Đỏ",
      "H.Cờ Đỏ",
      "H Cờ Đỏ",
      "Cờ Đỏ",
      "Co Do"
    ]
  },
  {
    "district_id": 1576,
    "district_name": "Quận Thốt Nốt",
    "province_id": 220,
    "v3_province_id": 1000005,
    "code": "5508",
    "name_extensions": [
      "Quận Thốt Nốt",
      "Q.Thốt Nốt",
      "Q Thốt Nốt",
      "Thốt Nốt",
      "Thot Not"
    ]
  },
  {
    "district_id": 1575,
    "district_name": "Quận Ô Môn",
    "province_id": 220,
    "v3_province_id": 1000005,
    "code": "5504",
    "name_extensions": [
      "Quận Ô Môn",
      "Q.Ô Môn",
      "Q Ô Môn",
      "Ô Môn",
      "O Mon"
    ]
  },
  {
    "district_id": 1574,
    "district_name": "Quận Cái Răng",
    "province_id": 220,
    "v3_province_id": 1000005,
    "code": "5503",
    "name_extensions": [
      "Quận Cái Răng",
      "Q.Cái Răng",
      "Q Cái Răng",
      "Cái Răng",
      "Cai Rang"
    ]
  },
  {
    "district_id": 1573,
    "district_name": "Quận Bình Thủy",
    "province_id": 220,
    "v3_province_id": 1000005,
    "code": "5502",
    "name_extensions": [
      "Quận Bình Thủy",
      "Q.Bình Thủy",
      "Q Bình Thủy",
      "Bình Thủy",
      "Binh Thuy"
    ]
  },
  {
    "district_id": 1572,
    "district_name": "Quận Ninh Kiều",
    "province_id": 220,
    "v3_province_id": 1000005,
    "code": "5501",
    "name_extensions": [
      "Quận Ninh Kiều",
      "Q.Ninh Kiều",
      "Q Ninh Kiều",
      "Ninh Kiều",
      "Ninh Kieu"
    ]
  },
  {
    "district_id": 3203,
    "district_name": "Huyện Kiến Thụy",
    "province_id": 224,
    "v3_province_id": 1000004,
    "code": "0308",
    "name_extensions": [
      "Huyện Kiến Thụy",
      "H.Kiến Thụy",
      "H Kiến Thụy",
      "Kiến Thụy",
      "Kien Thuy"
    ]
  },
  {
    "district_id": 2108,
    "district_name": "Huyện đảo Cát Hải",
    "province_id": 224,
    "v3_province_id": 1000004,
    "code": "0313",
    "name_extensions": [
      "Huyện đảo Cát Hải",
      "Cát Hải",
      "dao Cat Hai",
      "Huyen dao Cat Hai",
      "Huyện Đảo Cát Hải"
    ]
  },
  {
    "district_id": 2107,
    "district_name": "Huyện đảo Bạch Long Vĩ",
    "province_id": 224,
    "v3_province_id": 1000004,
    "code": "0314",
    "name_extensions": [
      "Huyện đảo Bạch Long Vĩ",
      "Bạch Long Vĩ",
      "dao Bach Long Vi",
      "Huyen dao Bach Long Vi",
      "bachlongvi"
    ]
  },
  {
    "district_id": 1822,
    "district_name": "Huyện Vĩnh Bảo",
    "province_id": 224,
    "v3_province_id": 1000004,
    "code": "0312",
    "name_extensions": [
      "Huyện Vĩnh Bảo",
      "H.Vĩnh Bảo",
      "H Vĩnh Bảo",
      "Vĩnh Bảo",
      "Vinh Bao"
    ]
  },
  {
    "district_id": 1821,
    "district_name": "Huyện Tiên Lãng",
    "province_id": 224,
    "v3_province_id": 1000004,
    "code": "0311",
    "name_extensions": [
      "Huyện Tiên Lãng",
      "H.Tiên Lãng",
      "H Tiên Lãng",
      "Tiên Lãng",
      "Tien Lang"
    ]
  },
  {
    "district_id": 1820,
    "district_name": "Huyện An Lão",
    "province_id": 224,
    "v3_province_id": 1000004,
    "code": "0307",
    "name_extensions": [
      "Huyện An Lão",
      "H.An Lão",
      "H An Lão",
      "An Lão",
      "An Lao"
    ]
  },
  {
    "district_id": 1819,
    "district_name": "Huyện An Dương",
    "province_id": 224,
    "v3_province_id": 1000004,
    "code": "0310",
    "name_extensions": [
      "Huyện An Dương",
      "H.An Dương",
      "H An Dương",
      "An Dương",
      "An Duong"
    ]
  },
  {
    "district_id": 1726,
    "district_name": "Huyện Thủy Nguyên",
    "province_id": 224,
    "v3_province_id": 1000004,
    "code": "0309",
    "name_extensions": [
      "Huyện Thủy Nguyên",
      "H.Thủy Nguyên",
      "H Thủy Nguyên",
      "Thủy Nguyên",
      "Thuy Nguyen"
    ]
  },
  {
    "district_id": 1707,
    "district_name": "Quận Đồ Sơn",
    "province_id": 224,
    "v3_province_id": 1000004,
    "code": "0306",
    "name_extensions": [
      "Quận Đồ Sơn",
      "Q.Đồ Sơn",
      "Q Đồ Sơn",
      "Đồ Sơn",
      "Do Son"
    ]
  },
  {
    "district_id": 1706,
    "district_name": "Quận Dương Kinh",
    "province_id": 224,
    "v3_province_id": 1000004,
    "code": "0315",
    "name_extensions": [
      "Quận Dương Kinh",
      "Q.Dương Kinh",
      "Q Dương Kinh",
      "Dương Kinh",
      "Duong Kinh"
    ]
  },
  {
    "district_id": 1591,
    "district_name": "Quận Hải An",
    "province_id": 224,
    "v3_province_id": 1000004,
    "code": "0305",
    "name_extensions": [
      "Quận Hải An",
      "Q.Hải An",
      "Q Hải An",
      "Hải An",
      "Hai An"
    ]
  },
  {
    "district_id": 1590,
    "district_name": "Quận Kiến An",
    "province_id": 224,
    "v3_province_id": 1000004,
    "code": "0304",
    "name_extensions": [
      "Quận Kiến An",
      "Q.Kiến An",
      "Q Kiến An",
      "Kiến An",
      "Kien An"
    ]
  },
  {
    "district_id": 1589,
    "district_name": "Quận Hồng Bàng",
    "province_id": 224,
    "v3_province_id": 1000004,
    "code": "0301",
    "name_extensions": [
      "Quận Hồng Bàng",
      "Q.Hồng Bàng",
      "Q Hồng Bàng",
      "Hồng Bàng",
      "Hong Bang"
    ]
  },
  {
    "district_id": 1588,
    "district_name": "Quận Lê Chân",
    "province_id": 224,
    "v3_province_id": 1000004,
    "code": "0302",
    "name_extensions": [
      "Quận Lê Chân",
      "Q.Lê Chân",
      "Q Lê Chân",
      "Lê Chân",
      "Le Chan"
    ]
  },
  {
    "district_id": 1587,
    "district_name": "Quận Ngô Quyền",
    "province_id": 224,
    "v3_province_id": 1000004,
    "code": "0303",
    "name_extensions": [
      "Quận Ngô Quyền",
      "Q.Ngô Quyền",
      "Q Ngô Quyền",
      "Ngô Quyền",
      "Ngo Quyen"
    ]
  },
  {
    "district_id": 2112,
    "district_name": "Huyện đảo Hoàng Sa",
    "province_id": 203,
    "v3_province_id": 1000003,
    "code": "0408",
    "name_extensions": [
      "Huyện đảo Hoàng Sa",
      "Huyện Hoàng Sa",
      "Hoàng Sa",
      "Hoang Sa",
      "Huyen dao Hoang Sa"
    ]
  },
  {
    "district_id": 1687,
    "district_name": "Huyện Hòa Vang",
    "province_id": 203,
    "v3_province_id": 1000003,
    "code": "0406",
    "name_extensions": [
      "Huyện Hòa Vang",
      "H.Hòa Vang",
      "H Hòa Vang",
      "Hòa Vang",
      "Hoa Vang"
    ]
  },
  {
    "district_id": 1531,
    "district_name": "Quận Cẩm Lệ",
    "province_id": 203,
    "v3_province_id": 1000003,
    "code": "0407",
    "name_extensions": [
      "Quận Cẩm Lệ",
      "Q.Cẩm Lệ",
      "Q Cẩm Lệ",
      "Cẩm Lệ",
      "Cam Le"
    ]
  },
  {
    "district_id": 1530,
    "district_name": "Quận Liên Chiểu",
    "province_id": 203,
    "v3_province_id": 1000003,
    "code": "0405",
    "name_extensions": [
      "Quận Liên Chiểu",
      "Q.Liên Chiểu",
      "Q Liên Chiểu",
      "Liên Chiểu",
      "Lien Chieu"
    ]
  },
  {
    "district_id": 1529,
    "district_name": "Quận Ngũ Hành Sơn",
    "province_id": 203,
    "v3_province_id": 1000003,
    "code": "0404",
    "name_extensions": [
      "Quận Ngũ Hành Sơn",
      "Q.Ngũ Hành Sơn",
      "Q Ngũ Hành Sơn",
      "Ngũ Hành Sơn",
      "Ngu Hanh Son"
    ]
  },
  {
    "district_id": 1528,
    "district_name": "Quận Sơn Trà",
    "province_id": 203,
    "v3_province_id": 1000003,
    "code": "0403",
    "name_extensions": [
      "Quận Sơn Trà",
      "Q.Sơn Trà",
      "Q Sơn Trà",
      "Sơn Trà",
      "Son Tra"
    ]
  },
  {
    "district_id": 1527,
    "district_name": "Quận Thanh Khê",
    "province_id": 203,
    "v3_province_id": 1000003,
    "code": "0402",
    "name_extensions": [
      "Quận Thanh Khê",
      "Q.Thanh Khê",
      "Q Thanh Khê",
      "Thanh Khê",
      "Thanh Khe"
    ]
  },
  {
    "district_id": 1526,
    "district_name": "Quận Hải Châu",
    "province_id": 203,
    "v3_province_id": 1000003,
    "code": "0401",
    "name_extensions": [
      "Quận Hải Châu",
      "Q.Hải Châu",
      "Q Hải Châu",
      "Hải Châu",
      "Hai Chau"
    ]
  },
  {
    "district_id": 3768,
    "district_name": "Quận Thuận Hóa",
    "province_id": 223,
    "v3_province_id": 1000002,
    "name_extensions": [
      "quận thuận hóa",
      "Quận Thuận Hóa",
      "quan thuan hoa",
      "Quan Thuan Hoa",
      "thuận hóa"
    ]
  },
  {
    "district_id": 3767,
    "district_name": "Quận Phú Xuân",
    "province_id": 223,
    "v3_province_id": 1000002,
    "name_extensions": [
      "quận phú xuân",
      "Quận Phú Xuân",
      "quan phu xuan",
      "Quan Phu Xuan",
      "phú xuân"
    ]
  },
  {
    "district_id": 3257,
    "district_name": "Huyện Quảng Điền",
    "province_id": 223,
    "v3_province_id": 1000002,
    "code": "3303",
    "name_extensions": [
      "Huyện Quảng Điền",
      "H.Quảng Điền",
      "H Quảng Điền",
      "Quảng Điền",
      "Quang Dien"
    ]
  },
  {
    "district_id": 3234,
    "district_name": "Huyện Nam Đông",
    "province_id": 223,
    "v3_province_id": 1000002,
    "code": "3308",
    "name_extensions": [
      "Huyện Nam Đông",
      "H.Nam Đông",
      "H Nam Đông",
      "Nam Đông",
      "Nam Dong"
    ]
  },
  {
    "district_id": 2193,
    "district_name": "Huyện Phong Điền",
    "province_id": 223,
    "v3_province_id": 1000002,
    "code": "3302",
    "name_extensions": [
      "Huyện Phong Điền",
      "H.Phong Điền",
      "H Phong Điền",
      "Phong Điền",
      "Phong Dien"
    ]
  },
  {
    "district_id": 1885,
    "district_name": "Huyện A Lưới",
    "province_id": 223,
    "v3_province_id": 1000002,
    "code": "3309",
    "name_extensions": [
      "Huyện A Lưới",
      "H.A Lưới",
      "H A Lưới",
      "A Lưới",
      "A Luoi"
    ]
  },
  {
    "district_id": 1882,
    "district_name": "Huyện Phú Lộc",
    "province_id": 223,
    "v3_province_id": 1000002,
    "code": "3307",
    "name_extensions": [
      "Huyện Phú Lộc",
      "H.Phú Lộc",
      "H Phú Lộc",
      "Phú Lộc",
      "Phu Loc"
    ]
  },
  {
    "district_id": 1749,
    "district_name": "Huyện Phú Vang",
    "province_id": 223,
    "v3_province_id": 1000002,
    "code": "3305",
    "name_extensions": [
      "Huyện Phú Vang",
      "H.Phú Vang",
      "H Phú Vang",
      "Phú Vang",
      "Phu Vang"
    ]
  },
  {
    "district_id": 1698,
    "district_name": "Thị xã Hương Thủy",
    "province_id": 223,
    "v3_province_id": 1000002,
    "code": "3306",
    "name_extensions": [
      "Thị xã Hương Thủy",
      "TX.Hương Thủy",
      "TX Hương Thủy",
      "Hương Thủy",
      "Huong Thuy"
    ]
  },
  {
    "district_id": 1697,
    "district_name": "Thị xã Hương Trà",
    "province_id": 223,
    "v3_province_id": 1000002,
    "code": "3304",
    "name_extensions": [
      "Thị xã Hương Trà",
      "TX.Hương Trà",
      "TX Hương Trà",
      "Hương Trà",
      "Huong Tra"
    ]
  },
  {
    "district_id": 1585,
    "district_name": "Thành phố Huế",
    "province_id": 223,
    "v3_province_id": 1000002,
    "code": "3301",
    "name_extensions": [
      "Thành phố Huế",
      "TP.Huế",
      "TP Huế",
      "Huế",
      "Hue"
    ]
  },
  {
    "district_id": 3695,
    "district_name": "Thành Phố Thủ Đức",
    "province_id": 202,
    "v3_province_id": 1000001,
    "code": "3695",
    "name_extensions": [
      "TP Thủ Đức",
      "thành phố thủ đức",
      "TP. Thủ Đức",
      "TP. Thu Duc",
      "thuduc"
    ]
  },
  {
    "district_id": 2090,
    "district_name": "Huyện Cần Giờ",
    "province_id": 202,
    "v3_province_id": 1000001,
    "code": "0224",
    "name_extensions": [
      "Huyện Cần Giờ",
      "H.Cần Giờ",
      "H Cần Giờ",
      "Cần Giờ",
      "Can Gio"
    ]
  },
  {
    "district_id": 1534,
    "district_name": "Huyện Nhà Bè",
    "province_id": 202,
    "v3_province_id": 1000001,
    "code": "0223",
    "name_extensions": [
      "Huyện Nhà Bè",
      "H.Nhà Bè",
      "H Nhà Bè",
      "Nhà Bè",
      "Nha Be"
    ]
  },
  {
    "district_id": 1533,
    "district_name": "Huyện Bình Chánh",
    "province_id": 202,
    "v3_province_id": 1000001,
    "code": "0220",
    "name_extensions": [
      "Huyện Bình Chánh",
      "H.Bình Chánh",
      "H Bình Chánh",
      "Bình Chánh",
      "Binh Chanh"
    ]
  },
  {
    "district_id": 1463,
    "district_name": "Quận Thủ Đức",
    "province_id": 202,
    "v3_province_id": 1000001,
    "code": "0218",
    "name_extensions": [
      "Thu Duc District"
    ]
  },
  {
    "district_id": 1462,
    "district_name": "Quận Bình Thạnh",
    "province_id": 202,
    "v3_province_id": 1000001,
    "code": "0216",
    "name_extensions": [
      "Quận Bình Thạnh",
      "Q.Bình Thạnh",
      "Q Bình Thạnh",
      "Bình Thạnh",
      "Binh Thanh"
    ]
  },
  {
    "district_id": 1461,
    "district_name": "Quận Gò Vấp",
    "province_id": 202,
    "v3_province_id": 1000001,
    "code": "0213",
    "name_extensions": [
      "Quận Gò Vấp",
      "Q.Gò Vấp",
      "Q Gò Vấp",
      "Gò Vấp",
      "Go Vap"
    ]
  },
  {
    "district_id": 1460,
    "district_name": "Huyện Củ Chi",
    "province_id": 202,
    "v3_province_id": 1000001,
    "code": "0221",
    "name_extensions": [
      "Huyện Củ Chi",
      "H.Củ Chi",
      "H Củ Chi",
      "Củ Chi",
      "Cu Chi"
    ]
  },
  {
    "district_id": 1459,
    "district_name": "Huyện Hóc Môn",
    "province_id": 202,
    "v3_province_id": 1000001,
    "code": "0222",
    "name_extensions": [
      "Huyện Hóc Môn",
      "H.Hóc Môn",
      "H Hóc Môn",
      "Hóc Môn",
      "Hoc Mon"
    ]
  },
  {
    "district_id": 1458,
    "district_name": "Quận Bình Tân",
    "province_id": 202,
    "v3_province_id": 1000001,
    "code": "0219",
    "name_extensions": [
      "Quận Bình Tân",
      "Q.Bình Tân",
      "Q Bình Tân",
      "Bình Tân",
      "Binh Tan"
    ]
  },
  {
    "district_id": 1457,
    "district_name": "Quận Phú Nhuận",
    "province_id": 202,
    "v3_province_id": 1000001,
    "code": "0217",
    "name_extensions": [
      "Quận Phú Nhuận",
      "Q.Phú Nhuận",
      "Q Phú Nhuận",
      "Phú Nhuận",
      "Phu Nhuan"
    ]
  },
  {
    "district_id": 1456,
    "district_name": "Quận Tân Phú",
    "province_id": 202,
    "v3_province_id": 1000001,
    "code": "0215",
    "name_extensions": [
      "Quận Tân Phú",
      "Q.Tân Phú",
      "Q Tân Phú",
      "Tân Phú",
      "Tan Phu"
    ]
  },
  {
    "district_id": 1455,
    "district_name": "Quận Tân Bình",
    "province_id": 202,
    "v3_province_id": 1000001,
    "code": "0214",
    "name_extensions": [
      "Quận Tân Bình",
      "Q.Tân Bình",
      "Q Tân Bình",
      "Tân Bình",
      "Tan Binh"
    ]
  },
  {
    "district_id": 1454,
    "district_name": "Quận 12",
    "province_id": 202,
    "v3_province_id": 1000001,
    "code": "0212",
    "name_extensions": [
      "Quận 12",
      "Q.12",
      "Q 12",
      "12",
      "Quan 12"
    ]
  },
  {
    "district_id": 1453,
    "district_name": "Quận 11",
    "province_id": 202,
    "v3_province_id": 1000001,
    "code": "0211",
    "name_extensions": [
      "Quận 11",
      "Q.11",
      "Q 11",
      "11",
      "Quan 11"
    ]
  },
  {
    "district_id": 1452,
    "district_name": "Quận 10",
    "province_id": 202,
    "v3_province_id": 1000001,
    "code": "0210",
    "name_extensions": [
      "Quận 10",
      "Q.10",
      "Q 10",
      "10",
      "Quan 10"
    ]
  },
  {
    "district_id": 1451,
    "district_name": "Quận 9",
    "province_id": 202,
    "v3_province_id": 1000001,
    "code": "0209",
    "name_extensions": [
      "Quận 9",
      "Q.9",
      "Q 9",
      "9",
      "Quan 9"
    ]
  },
  {
    "district_id": 1450,
    "district_name": "Quận 8",
    "province_id": 202,
    "v3_province_id": 1000001,
    "code": "0208",
    "name_extensions": [
      "Quận 8",
      "Q.8",
      "Q 8",
      "8",
      "Quan 8"
    ]
  },
  {
    "district_id": 1449,
    "district_name": "Quận 7",
    "province_id": 202,
    "v3_province_id": 1000001,
    "code": "0207",
    "name_extensions": [
      "Quận 7",
      "Q.7",
      "Q 7",
      "7",
      "Quan 7"
    ]
  },
  {
    "district_id": 1448,
    "district_name": "Quận 6",
    "province_id": 202,
    "v3_province_id": 1000001,
    "code": "0206",
    "name_extensions": [
      "Quận 6",
      "Q.6",
      "Q 6",
      "6",
      "Quan 6"
    ]
  },
  {
    "district_id": 1447,
    "district_name": "Quận 5",
    "province_id": 202,
    "v3_province_id": 1000001,
    "code": "0205",
    "name_extensions": [
      "Quận 5",
      "Q.5",
      "Q 5",
      "5",
      "Quan 5"
    ]
  },
  {
    "district_id": 1446,
    "district_name": "Quận 4",
    "province_id": 202,
    "v3_province_id": 1000001,
    "code": "0204",
    "name_extensions": [
      "Quận 4",
      "Q.4",
      "Q 4",
      "4",
      "Quan 4"
    ]
  },
  {
    "district_id": 1444,
    "district_name": "Quận 3",
    "province_id": 202,
    "v3_province_id": 1000001,
    "code": "0203",
    "name_extensions": [
      "Quận 3",
      "Q.3",
      "Q 3",
      "3",
      "Quan 3"
    ]
  },
  {
    "district_id": 1443,
    "district_name": "Quận 2",
    "province_id": 202,
    "v3_province_id": 1000001,
    "code": "0202",
    "name_extensions": [
      "Quận 2",
      "Q.2",
      "Q 2",
      "2",
      "Quan 2"
    ]
  },
  {
    "district_id": 1442,
    "district_name": "Quận 1",
    "province_id": 202,
    "v3_province_id": 1000001,
    "code": "0201",
    "name_extensions": [
      "Quận 1",
      "Q.1",
      "Q 1",
      "1",
      "Quan 1"
    ]
  },
  {
    "district_id": 3440,
    "district_name": "Quận Nam Từ Liêm",
    "province_id": 201,
    "v3_province_id": 1000000,
    "code": "0130",
    "name_extensions": [
      "Quận Nam Từ Liêm",
      "Q.Nam Từ Liêm",
      "Q Nam Từ Liêm",
      "Nam Từ Liêm",
      "Nam Tu Liem"
    ]
  },
  {
    "district_id": 3303,
    "district_name": "Huyện Thường Tín",
    "province_id": 201,
    "v3_province_id": 1000000,
    "code": "1B27",
    "name_extensions": [
      "Huyện Thường Tín",
      "H.Thường Tín",
      "H Thường Tín",
      "Thường Tín",
      "Thuong Tin"
    ]
  },
  {
    "district_id": 3255,
    "district_name": "Huyện Phú Xuyên",
    "province_id": 201,
    "v3_province_id": 1000000,
    "code": "1B28",
    "name_extensions": [
      "Huyện Phú Xuyên",
      "H.Phú Xuyên",
      "H Phú Xuyên",
      "Phú Xuyên",
      "Phu Xuyen"
    ]
  },
  {
    "district_id": 2004,
    "district_name": "Huyện Quốc Oai",
    "province_id": 201,
    "v3_province_id": 1000000,
    "code": "1B20",
    "name_extensions": [
      "Huyện Quốc Oai",
      "H.Quốc Oai",
      "H Quốc Oai",
      "Quốc Oai",
      "Quoc Oai"
    ]
  },
  {
    "district_id": 1915,
    "district_name": "Huyện Chương Mỹ",
    "province_id": 201,
    "v3_province_id": 1000000,
    "code": "1B21",
    "name_extensions": [
      "Huyện Chương Mỹ",
      "H.Chương Mỹ",
      "H Chương Mỹ",
      "Chương Mỹ",
      "Chuong My"
    ]
  },
  {
    "district_id": 1810,
    "district_name": "Huyện Ứng Hòa",
    "province_id": 201,
    "v3_province_id": 1000000,
    "code": "1B26",
    "name_extensions": [
      "Huyện Ứng Hòa",
      "H.Ứng Hòa",
      "H Ứng Hòa",
      "Ứng Hòa",
      "Ung Hoa"
    ]
  },
  {
    "district_id": 1809,
    "district_name": "Huyện Thanh Oai",
    "province_id": 201,
    "v3_province_id": 1000000,
    "code": "1B24",
    "name_extensions": [
      "Huyện Thanh Oai",
      "H.Thanh Oai",
      "H Thanh Oai",
      "Thanh Oai",
      "Huyen Thanh Oai"
    ]
  },
  {
    "district_id": 1808,
    "district_name": "Huyện Thạch Thất",
    "province_id": 201,
    "v3_province_id": 1000000,
    "code": "1B19",
    "name_extensions": [
      "Huyện Thạch Thất",
      "H.Thạch Thất",
      "H Thạch Thất",
      "Thạch Thất",
      "Thach That"
    ]
  },
  {
    "district_id": 1807,
    "district_name": "Huyện Phúc Thọ",
    "province_id": 201,
    "v3_province_id": 1000000,
    "code": "1B18",
    "name_extensions": [
      "Huyện Phúc Thọ",
      "H.Phúc Thọ",
      "H Phúc Thọ",
      "Phúc Thọ",
      "Phuc Tho"
    ]
  },
  {
    "district_id": 1806,
    "district_name": "Huyện Mỹ Đức",
    "province_id": 201,
    "v3_province_id": 1000000,
    "code": "1B25",
    "name_extensions": [
      "Huyện Mỹ Đức",
      "H.Mỹ Đức",
      "H Mỹ Đức",
      "Mỹ Đức",
      "My Duc"
    ]
  },
  {
    "district_id": 1805,
    "district_name": "Huyện Hoài Đức",
    "province_id": 201,
    "v3_province_id": 1000000,
    "code": "1B23",
    "name_extensions": [
      "Huyện Hoài Đức",
      "H.Hoài Đức",
      "H Hoài Đức",
      "Hoài Đức",
      "Hoai Duc"
    ]
  },
  {
    "district_id": 1804,
    "district_name": "Huyện Đan Phượng",
    "province_id": 201,
    "v3_province_id": 1000000,
    "code": "1B22",
    "name_extensions": [
      "Huyện Đan Phượng",
      "H.Đan Phượng",
      "H Đan Phượng",
      "Đan Phượng",
      "Dan Phuong"
    ]
  },
  {
    "district_id": 1803,
    "district_name": "Huyện Ba Vì",
    "province_id": 201,
    "v3_province_id": 1000000,
    "code": "1B17",
    "name_extensions": [
      "Huyện Ba Vì",
      "H.Ba Vì",
      "H Ba Vì",
      "Ba Vì",
      "Ba Vi"
    ]
  },
  {
    "district_id": 1711,
    "district_name": "Thị xã Sơn Tây",
    "province_id": 201,
    "v3_province_id": 1000000,
    "code": "1B16",
    "name_extensions": [
      "Thị xã Sơn Tây",
      "TX.Sơn Tây",
      "TX Sơn Tây",
      "Sơn Tây",
      "Son Tay"
    ]
  },
  {
    "district_id": 1710,
    "district_name": "Huyện Thanh Trì",
    "province_id": 201,
    "v3_province_id": 1000000,
    "code": "1A11",
    "name_extensions": [
      "Huyện Thanh Trì",
      "H.Thanh Trì",
      "H Thanh Trì",
      "Thanh Trì",
      "Thanh Tri"
    ]
  },
  {
    "district_id": 1703,
    "district_name": "Huyện Gia Lâm",
    "province_id": 201,
    "v3_province_id": 1000000,
    "code": "1A12",
    "name_extensions": [
      "Huyện Gia Lâm",
      "H.Gia Lâm",
      "H Gia Lâm",
      "Gia Lâm",
      "Gia Lam"
    ]
  },
  {
    "district_id": 1583,
    "district_name": "Huyện Sóc Sơn",
    "province_id": 201,
    "v3_province_id": 1000000,
    "code": "1A14",
    "name_extensions": [
      "Huyện Sóc Sơn",
      "H.Sóc Sơn",
      "H Sóc Sơn",
      "Sóc Sơn",
      "Soc Son"
    ]
  },
  {
    "district_id": 1582,
    "district_name": "Huyện Đông Anh",
    "province_id": 201,
    "v3_province_id": 1000000,
    "code": "1A13",
    "name_extensions": [
      "Huyện Đông Anh",
      "H.Đông Anh",
      "H Đông Anh",
      "Đông Anh",
      "Dong Anh"
    ]
  },
  {
    "district_id": 1581,
    "district_name": "Huyện Mê Linh",
    "province_id": 201,
    "v3_province_id": 1000000,
    "code": "1B29",
    "name_extensions": [
      "Huyện Mê Linh",
      "H.Mê Linh",
      "H Mê Linh",
      "Mê Linh",
      "Me Linh"
    ]
  },
  {
    "district_id": 1542,
    "district_name": "Quận Hà Đông",
    "province_id": 201,
    "v3_province_id": 1000000,
    "code": "1B15",
    "name_extensions": [
      "Quận Hà Đông",
      "Q.Hà Đông",
      "Q Hà Đông",
      "Hà Đông",
      "Ha Dong"
    ]
  },
  {
    "district_id": 1493,
    "district_name": "Quận Thanh Xuân",
    "province_id": 201,
    "v3_province_id": 1000000,
    "code": "1A07",
    "name_extensions": [
      "Quận Thanh Xuân",
      "Q.Thanh Xuân",
      "Q Thanh Xuân",
      "Thanh Xuân",
      "QTX"
    ]
  },
  {
    "district_id": 1492,
    "district_name": "Quận Tây Hồ",
    "province_id": 201,
    "v3_province_id": 1000000,
    "code": "1A05",
    "name_extensions": [
      "Quận Tây Hồ",
      "Q.Tây Hồ",
      "Q Tây Hồ",
      "Tây Hồ",
      "Tay Ho"
    ]
  },
  {
    "district_id": 1491,
    "district_name": "Quận Long Biên",
    "province_id": 201,
    "v3_province_id": 1000000,
    "code": "1A09",
    "name_extensions": [
      "Quận Long Biên",
      "Q.Long Biên",
      "Q Long Biên",
      "Long Biên",
      "Long Bien"
    ]
  },
  {
    "district_id": 1490,
    "district_name": "Quận Hoàng Mai",
    "province_id": 201,
    "v3_province_id": 1000000,
    "code": "1A08",
    "name_extensions": [
      "Quận Hoàng Mai",
      "Q.Hoàng Mai",
      "Q Hoàng Mai",
      "Hoàng Mai",
      "Hoang Mai"
    ]
  },
  {
    "district_id": 1489,
    "district_name": "Quận Hoàn Kiếm",
    "province_id": 201,
    "v3_province_id": 1000000,
    "code": "1A02",
    "name_extensions": [
      "Quận Hoàn Kiếm",
      "Q.Hoàn Kiếm",
      "Q Hoàn Kiếm",
      "Hoàn Kiếm",
      "Hoan Kiem"
    ]
  },
  {
    "district_id": 1488,
    "district_name": "Quận Hai Bà Trưng",
    "province_id": 201,
    "v3_province_id": 1000000,
    "code": "1A03",
    "name_extensions": [
      "Quận Hai Bà Trưng",
      "Q.Hai Bà Trưng",
      "Q Hai Bà Trưng",
      "Hai Bà Trưng",
      "Hai Ba Trung"
    ]
  },
  {
    "district_id": 1486,
    "district_name": "Quận Đống Đa",
    "province_id": 201,
    "v3_province_id": 1000000,
    "code": "1A04",
    "name_extensions": [
      "Quận Đống Đa",
      "Q.Đống Đa",
      "Q Đống Đa",
      "Đống Đa",
      "Dong Da"
    ]
  },
  {
    "district_id": 1485,
    "district_name": "Quận Cầu Giấy",
    "province_id": 201,
    "v3_province_id": 1000000,
    "code": "1A06",
    "name_extensions": [
      "Quận Cầu Giấy",
      "Q.Cầu Giấy",
      "Q Cầu Giấy",
      "Cầu Giấy",
      "Cau Giay"
    ]
  },
  {
    "district_id": 1484,
    "district_name": "Quận Ba Đình",
    "province_id": 201,
    "v3_province_id": 1000000,
    "code": "1A01",
    "name_extensions": [
      "Quận Ba Đình",
      "Q.Ba Đình",
      "Q Ba Đình",
      "Ba Đình",
      "Ba Dinh"
    ]
  },
  {
    "district_id": 1482,
    "district_name": "Quận Bắc Từ Liêm",
    "province_id": 201,
    "v3_province_id": 1000000,
    "code": "0110",
    "name_extensions": [
      "Quận Bắc Từ Liêm",
      "Q.Bắc Từ Liêm",
      "Q Bắc Từ Liêm",
      "Bắc Từ Liêm",
      "Bac Tu Liem"
    ]
  }
]

/**
 * Ánh xạ từ thông tin địa chỉ người dùng (kể cả mô hình 2 cấp GHN v3)
 * sang to_district_id và to_ward_code hợp lệ cho API tính phí GHN v2.
 */
export function resolveLegacyAddress(input: AddressResolutionInput): LegacyAddressResult | null {
  // 1. Nếu đã có sẵn districtId hợp lệ từ input
  const inputDistrictId = Number(input.districtId)
  if (!isNaN(inputDistrictId) && inputDistrictId > 0) {
    const foundDistrict = GHN_DISTRICT_LIST.find((d) => d.district_id === inputDistrictId)
    const prov = foundDistrict
      ? GHN_PROVINCE_V3_MAP.find((p) => p.v3_id === foundDistrict.v3_province_id)
      : null

    return {
      provinceId: prov?.legacy_province_id || foundDistrict?.province_id || 202,
      provinceName: prov?.legacy_province_name || prov?.v3_name || "Hồ Chí Minh",
      districtId: inputDistrictId,
      districtName: input.districtName || foundDistrict?.district_name || "",
      wardCode: String(input.wardCode || prov?.default_ward_code || "20101"),
      wardName: input.wardName || prov?.default_ward_name || "",
      matchedBy: "direct_input",
      v3ProvinceId: prov?.v3_id,
      v3ProvinceName: prov?.v3_name,
    }
  }

  // 2. Tìm Tỉnh / Thành phố theo v3_id hoặc Tên
  const provQuery = String(input.provinceName || input.province || "").trim()
  const provId = Number(input.provinceId)

  let matchedProvince: GhnProvinceMapping | undefined

  if (!isNaN(provId) && provId > 0) {
    matchedProvince = GHN_PROVINCE_V3_MAP.find(
      (p) => p.v3_id === provId || p.legacy_province_id === provId
    )
  }

  if (!matchedProvince && provQuery) {
    const qClean = removeVietnameseTones(provQuery)
    matchedProvince = GHN_PROVINCE_V3_MAP.find((p) => {
      const pClean = removeVietnameseTones(p.v3_name)
      const legClean = removeVietnameseTones(p.legacy_province_name)
      if (pClean === qClean || legClean === qClean) return true
      if (qClean.includes(pClean) || pClean.includes(qClean)) return true
      return p.aliases.some((alias) => {
        const aClean = removeVietnameseTones(alias)
        return aClean === qClean || qClean.includes(aClean)
      })
    })
  }

  // Nếu không tìm thấy tỉnh nào, trả về null (để caller quyết định)
  if (!matchedProvince) {
    return null
  }

  // 3. Tìm Quận / Huyện cụ thể bên trong Tỉnh đó dựa vào wardName, city, districtName, address1
  const searchTexts = [
    input.districtName,
    input.district,
    input.wardName,
    input.city,
    input.address1,
  ]
    .filter(Boolean)
    .map((t) => removeVietnameseTones(String(t)))

  // Lọc các quận thuộc tỉnh này
  const districtsInProvince = GHN_DISTRICT_LIST.filter(
    (d) =>
      d.v3_province_id === matchedProvince!.v3_id ||
      d.province_id === matchedProvince!.legacy_province_id
  )

  let matchedDistrict: GhnDistrictMapping | undefined

  for (const text of searchTexts) {
    matchedDistrict = districtsInProvince.find((d) => {
      const dClean = removeVietnameseTones(d.district_name)
      // Bỏ tiền tố "quan", "huyen", "thanh pho", "thi xa"
      const shortD = dClean.replace(/^(quan|huyen|thanh pho|thi xa)\s+/i, "")
      if (text.includes(dClean) || (shortD.length > 2 && text.includes(shortD))) {
        return true
      }
      return d.name_extensions?.some((ext) => {
        const extClean = removeVietnameseTones(ext)
        return extClean.length > 2 && text.includes(extClean)
      })
    })
    if (matchedDistrict) break
  }

  if (matchedDistrict) {
    return {
      provinceId: matchedProvince.legacy_province_id,
      provinceName: matchedProvince.legacy_province_name,
      districtId: matchedDistrict.district_id,
      districtName: matchedDistrict.district_name,
      wardCode: String(input.wardCode || matchedProvince.default_ward_code),
      wardName: input.wardName || matchedProvince.default_ward_name,
      matchedBy: "district_in_ward",
      v3ProvinceId: matchedProvince.v3_id,
      v3ProvinceName: matchedProvince.v3_name,
    }
  }

  // 4. Nếu không khớp quận cụ thể, dùng Quận trung tâm của Tỉnh đó
  return {
    provinceId: matchedProvince.legacy_province_id,
    provinceName: matchedProvince.legacy_province_name,
    districtId: matchedProvince.default_district_id,
    districtName: matchedProvince.default_district_name,
    wardCode: matchedProvince.default_ward_code,
    wardName: matchedProvince.default_ward_name,
    matchedBy: "province_default",
    v3ProvinceId: matchedProvince.v3_id,
    v3ProvinceName: matchedProvince.v3_name,
  }
}

/**
 * Ánh xạ ngược: Từ legacy districtId tìm ra Tỉnh / Thành phố mới (GHN v3)
 */
export function mapLegacyToNew(districtId: number): NewAddressResult | null {
  const d = GHN_DISTRICT_LIST.find((item) => item.district_id === districtId)
  if (!d) return null

  const p = GHN_PROVINCE_V3_MAP.find(
    (prov) => prov.v3_id === d.v3_province_id || prov.legacy_province_id === d.province_id
  )
  if (!p) return null

  return {
    provinceId: p.v3_id,
    provinceName: p.v3_name,
  }
}
