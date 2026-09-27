# GHN Fulfillment Provider — Kiến Trúc, Business Rules & Hợp Đồng Tích Hợp

> **Cập nhật lần cuối:** 2026-09-27  
> **Nguyên tắc thiết kế cốt lõi:** Tách biệt rõ ràng giữa **Medusa Configuration** và **GHN Runtime Data**.  
> **Tham chiếu tài liệu GHN:** [Tính phí (Calculate Fee)](https://developer.ghn.dev/vi/docs/order/calculate-fee) & [Tạo đơn (Create Order)](https://developer.ghn.dev/vi/docs/order/create#cau-truc-items).

---

## 1. Nguyên Tắc Thiết Kế Cốt Lõi

### Medusa vs GHN — Hai Lớp Hoàn Toàn Tách Biệt

```
Medusa Configuration (Admin setup, lưu vào DB)
--------------------------------------------------------------
  Shipping Option: "GHN Delivery"
    - fulfillment_option.id = "ghn-delivery"  <- Không gắn service_type_id!
    - price_type = "calculated"
    - provider_id = "ghn"

           │
           │  (Checkout Runtime - KHÔNG lưu DB)
           ▼

GHN Runtime Data (tính động mỗi lần checkout)
--------------------------------------------------------------
  getAvailableServices(from_district, to_district)
    -> [{ service_type_id: 2, short_name: "Hàng nhẹ" },
        { service_type_id: 5, short_name: "Hàng nặng" }]
           │
           ▼
  resolveServiceTypeId(services, weight)
    - weight < 20kg  -> service_type_id = 2
    - weight >= 20kg -> service_type_id = 5
           │
           ▼
  calculateFee({ from_district, to_district, weight, service_type_id, items? })
    -> total: 20900  <- Giá cước thật từ GHN API
           │
           ▼
  Medusa: calculated_amount = 20900
```

### Lý Do KHÔNG Embed `service_type_id` Vào `FulfillmentOption`

| Vấn đề | Giải thích |
|---|---|
| `service_type_id` phụ thuộc **tuyến đường** | GHN chỉ cho biết service nào khả dụng SAU KHI biết `from_district` và `to_district` |
| `service_type_id` phụ thuộc **cân nặng & kiện hàng** | Hàng nhẹ < 20kg dùng type 2; hàng nặng >= 20kg / nhiều kiện dùng type 5 |
| `service_type_id` phụ thuộc **hợp đồng Shop** | Cùng một tuyến, Shop khác nhau có thể được cấp bảng giá/dịch vụ khác nhau |
| Admin không biết trước địa chỉ người mua | Tại thời điểm Admin cấu hình Shipping Option, chưa có `to_district` nào |

---

## 2. Business Rules: Phân Loại Dịch Vụ & Kiện Hàng (Packaging Rules)

### 2.1 Bối Cảnh Nghiệp Vụ Giỏ Hàng (Cart) & Kiện Hàng
Trong Medusa, một giỏ hàng có thể chứa nhiều sản phẩm (multi-items) với số lượng và kích cỡ khác nhau. Việc phân chia kiện hàng (cartonization / parcel packaging) là một bài toán phức tạp đòi hỏi cấu hình bao bì chuyên sâu. 

Để đảm bảo tính nhất quán, minh bạch và khả thi cao nhất khi tích hợp GHN API, hệ thống chuẩn hóa **Business Rules** như sau:

### 2.2 Quy Tắc Phân Loại Gói Cước Theo Khối Lượng
1. **Đơn hàng chuẩn / Hàng nhẹ (`totalWeight < 20.000g` — dưới 20kg)**:
   - Coi toàn bộ giỏ hàng là **1 kiện hàng tiêu chuẩn**.
   - Mặc định sử dụng **`service_type_id = 2`** (Gói Chuẩn / Hàng nhẹ).
   - GHN tính phí theo tổng khối lượng và kích thước ở cấp đơn hàng.
2. **Bưu kiện nặng / Đơn nhiều kiện (`totalWeight >= 20.000g` — từ 20kg trở lên)**:
   - Coi toàn bộ giỏ hàng là **Bưu kiện nặng hoặc nhiều kiện hàng**.
   - Bắt buộc sử dụng **`service_type_id = 5`** (Hàng nặng).
   - GHN tính phí lũy tiến chi tiết theo từng kiện con từ danh sách `items[]`.

### 2.3 Quy Chuẩn DTO Tham Số Tính Phí (`/v2/shipping-order/fee`)

Tuân thủ nghiêm ngặt tài liệu GHN Developer:

| Tham số | Kiểu dữ liệu | `service_type_id = 2` (< 20kg) | `service_type_id = 5` (≥ 20kg) | Ghi chú |
|---|---|---|---|---|
| `from_district_id` | Int | Bắt buộc | Bắt buộc | Kho gửi hàng (Stock Location) |
| `from_ward_code` | String | Tùy chọn | Tùy chọn | Phường kho gửi |
| `to_district_id` | Int | Bắt buộc | Bắt buộc | Quận/Huyện người nhận |
| `to_ward_code` | String | Bắt buộc | Bắt buộc | Phường/Xã người nhận |
| `service_type_id` | Int | **2** | **5** | Loại dịch vụ |
| `weight` | Int (gram) | Bắt buộc (tổng) | Bắt buộc (tổng) | Tổng khối lượng giỏ hàng |
| `length` | Int (cm) | **Bắt buộc** | Không bắt buộc | Kích thước cấp đơn hàng |
| `width` | Int (cm) | **Bắt buộc** | Không bắt buộc | Kích thước cấp đơn hàng |
| `height` | Int (cm) | **Bắt buộc** | Không bắt buộc | Kích thước cấp đơn hàng |
| `items` | Array of Object | Không bắt buộc | **BẮT BUỘC** | Danh sách chi tiết từng kiện con |

#### Cấu trúc mỗi phần tử trong mảng `items[]` (GHN DTO):
```typescript
interface GhnOrderItem {
  name: string      // Bắt buộc: Tên sản phẩm / kiện
  code?: string     // Tùy chọn: SKU sản phẩm
  quantity: number  // Bắt buộc: Số lượng kiện
  price?: number    // Tùy chọn: Đơn giá
  weight: number    // Bắt buộc: Khối lượng kiện (gram)
  length: number    // Bắt buộc: Chiều dài (cm)
  width: number     // Bắt buộc: Chiều rộng (cm)
  height: number    // Bắt buộc: Chiều cao (cm)
}
```

### 2.4 Thứ Tự Ưu Tiên Dữ Liệu Sản Phẩm (Data Hierarchy)
Khi trích xuất thông số từ Cart Line Items để xây dựng DTO cho GHN:
- **Cân nặng (Weight)**:
  1. `item.variant.weight` (Authoritative): Biến thể/SKU thực tế khách mua.
  2. `item.product.weight` (Fallback): Khối lượng khai báo ở sản phẩm cha.
  3. `defaultWeight` (System default): Mặc định `500g` từ module options.
- **Kích thước (Length, Width, Height)**:
  1. `item.variant.[dimension]`
  2. `item.product.[dimension]`
  3. `defaultDimensions`: Mặc định `10 x 10 x 10 cm`.

---

## 3. Chiến Lược Giả Định & Fallback Hai Chiều (Bidirectional Fallback)

### 3.1 Nguyên Tắc Giả Định Luôn Có 2 Type (2 & 5)
- Hệ thống luôn giả định rằng mạng lưới GHN hỗ trợ 2 loại dịch vụ chuẩn: `2` và `5`.
- Khi gọi `getAvailableServices()` để kiểm tra tuyến:
  - Nếu tuyến có gói ưu tiên (`2` cho nhẹ, `5` cho nặng) → Chọn đúng gói.
  - Nếu tuyến không liệt kê gói ưu tiên → Tự động chọn gói đối ứng còn lại (`2` ↔ `5`).
  - Nếu API lỗi hoặc danh sách trống → Mặc định chọn theo khối lượng (`preferredTypeId`), không chặn luồng thanh toán.

### 3.2 Cơ Chế Tự Động Fallback Khi Gọi GHN API Tính Phí
```mermaid
graph TD
    A[Bắt đầu tính cước] --> B{Khối lượng >= 20kg?}
    B -- Đúng --> C[Chọn service_type_id = 5<br/>Payload kèm items[]]
    B -- Sai --> D[Chọn service_type_id = 2<br/>Payload kèm root dimensions]
    
    C --> E[Gọi GHN calculateFee]
    E -- Thành công --> Z[Trả về calculated_amount]
    E -- Thất bại (400/500) --> F[Fallback: Chuyển sang service_type_id = 2<br/>Xóa items, dùng root dimensions]
    F --> G[Retry calculateFee]
    G -- Thành công --> Z
    G -- Thất bại --> H[Fallback giá sàn 35.000₫]

    D --> I[Gọi GHN calculateFee]
    I -- Thành công --> Z
    I -- Thất bại (400/500) --> J{Có items[]?}
    J -- Có --> K[Fallback: Thử service_type_id = 5<br/>Payload kèm items[]]
    K --> L[Retry calculateFee]
    L -- Thành công --> Z
    L -- Thất bại --> H
    J -- Không --> H
```

---

## 4. `getFulfillmentOptions()` — Chỉ Là Medusa Config

```typescript
// Medusa Admin Config: Chỉ khai báo 1 option định danh duy nhất
async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
  return [
    {
      id: "ghn-delivery",
      name: "GHN Delivery",
    },
  ]
}
```

---

## 5. Shipping Option Type — Nhãn Phân Loại & Gom Nhóm

`Shipping Option Type` (VD: Standard / Express / GHN Delivery) **KHÔNG** quyết định gói cước GHN hay giá vận chuyển.  
Nó phục vụ 2 mục đích chính trong Medusa:
1. **Phân loại / tổ chức** các shipping options trên giao diện Admin.
2. **Áp dụng Promotion**: Tạo promotion miễn phí vận chuyển cho cả nhóm Shipping Option Types (VD: Type `GHN Delivery`).

---

## 6. Bảng Tổng Hợp Xử Lý Ngoại Lệ (Fallback Matrix)

| Tình huống | Hành vi hệ thống | Kết quả trả về |
|---|---|---|
| Khách chưa nhập địa chỉ / Chưa có Quận, Tỉnh | Trả về phí tạm tính mặc định | **30.000₫** |
| Có Tỉnh nhưng chưa có District ID | Tạm tính theo kho Quận 1 (1442) | Giá thực tế GHN Quận 1 |
| Hàng ≥ 20kg nhưng Shop chưa mở bảng giá gói 5 | Tự động fallback sang gói chuẩn `service_type_id = 2` | Giá tính lũy tiến theo kg của gói 2 |
| Mạng GHN chập chờn / Shop Token không hợp lệ | Bắt ngoại lệ tại `try-catch`, log cảnh báo | Giá cước sàn **35.000₫** (không sập checkout) |