# 📖 Bảng Thuật Ngữ — Shipping & Fulfillment trong Medusa v2

> Tài liệu này giải thích tất cả các khái niệm, bảng dữ liệu, và mối quan hệ giữa chúng.
> **Đọc file này TRƯỚC khi đọc bất kỳ spec nào khác.**

---

## 1. Bản Đồ Tổng Quan — Shipping vs. Fulfillment

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        MEDUSA v2 — FULFILLMENT MODULE                       │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                     CẤU HÌNH (ADMIN SETUP TIME)                       │  │
│  │                                                                        │  │
│  │  Stock Location ──┬── FulfillmentSet ──── ServiceZone ──── GeoZone    │  │
│  │  (Kho hàng)       │   (Nhóm provider)     (Vùng giao)     (Địa lý)   │  │
│  │                   │                             │                      │  │
│  │                   │                        ShippingOption              │  │
│  │                   │                        (Lựa chọn ship)            │  │
│  │                   │                             │                      │  │
│  │                   └── FulfillmentProvider ───────┘                      │  │
│  │                       (GHN, Manual, ShipStation...)                    │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                 VẬN HÀNH (RUNTIME / CHECKOUT & ORDER)                 │  │
│  │                                                                        │  │
│  │  Cart ──── ShippingMethod ──── Fulfillment ──── FulfillmentItem       │  │
│  │  (Giỏ)     (Method đã chọn)    (Vận đơn)       (Item trong vận đơn)  │  │
│  │                                      │                                 │  │
│  │                                 FulfillmentLabel                       │  │
│  │                                 (Nhãn giao hàng)                      │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Từ Điển Khái Niệm Chi Tiết

### 2.1 Cấu Hình (Setup-time Entities)

| Khái niệm | Bảng DB Medusa | Giải thích bằng ví dụ VN |
|---|---|---|
| **Stock Location** | `stock_location` | Đây là **kho hàng vật lý**. VD: "Kho Quận 7 — 123 Nguyễn Văn Linh, HCM". Mỗi kho có địa chỉ riêng, và sẽ ảnh hưởng đến phí ship (vì GHN tính theo khoảng cách từ kho → nhà khách). |
| **Fulfillment Set** | `fulfillment_set` | Là tập hợp các nhà vận chuyển (provider) được phép hoạt động **tại một kho** cụ thể. VD: Kho Q7 cho phép cả GHN lẫn Manual. |
| **Fulfillment Provider** | `fulfillment_provider` | Là **đơn vị vận chuyển** thực tế: GHN, GHTK, Manual (tự giao), ShipStation… Module code ta viết (`GiaoHangNhanhProviderService`) đăng ký vào đây. ID mẫu: `fp_ghn_ghn`. |
| **Service Zone** | `service_zone` | Là **vùng địa lý** mà kho phục vụ. VD: "Vùng Toàn quốc VN", "Vùng Nội thành HCM". Mỗi zone chứa 1+ GeoZone. |
| **Geo Zone** | `geo_zone` | Là **điều kiện địa lý cụ thể** trong một Service Zone. VD: `country_code = "vn"` (cả nước VN), hoặc `province_code = "SG"` (chỉ Sài Gòn). |
| **Shipping Option** | `shipping_option` | Là **lựa chọn vận chuyển** hiển thị cho khách ở checkout. VD: "GHN Tiêu Chuẩn — Calculated price", "Giao Manual — 50.000₫ Flat rate". Mỗi option thuộc 1 Service Zone và gắn với 1 Provider. |
| **Shipping Profile** | `shipping_profile` | Nhóm các sản phẩm có cùng quy cách giao hàng. VD: "Hàng thường" vs "Hàng cồng kềnh". Medusa gán `default` cho tất cả. |

### 2.2 Vận Hành (Runtime Entities)

| Khái niệm | Bảng DB Medusa | Giải thích bằng ví dụ VN |
|---|---|---|
| **Shipping Method** | `shipping_method` (trong Order/Cart module) | Khi khách **chọn** một Shipping Option ở checkout, nó trở thành Shipping Method gắn vào Cart/Order. VD: Khách chọn "GHN Tiêu Chuẩn" → 1 ShippingMethod được tạo với `amount = 32,500₫`. |
| **Fulfillment** | `fulfillment` | Là **vận đơn thực tế** tạo ra khi Admin bấm "Create Fulfillment" từ Order detail. Lúc này Medusa gọi `createFulfillment()` của Provider → GHN trả về `order_code`. |
| **Fulfillment Item** | `fulfillment_item` | Mỗi item trong vận đơn. VD: Đơn hàng có 3 sản phẩm, giao 2 lần → Fulfillment 1 có 2 FulfillmentItem, Fulfillment 2 có 1. |
| **Fulfillment Label** | `fulfillment_label` | Nhãn vận chuyển (phiếu gửi hàng). Chứa `tracking_number` (mã vận đơn GHN), `tracking_url` (link tra cứu), `label_url` (link in phiếu A5). |

---

## 3. Hai Loại Giá Ship

| Loại | Cách cấu hình | Ai tính? | Khi nào dùng? |
|---|---|---|---|
| **Flat Rate** | Admin nhập giá cố định (VD: 50.000₫) | Admin | Giao thủ công, giá cố định |
| **Calculated** | Admin chọn "Calculated" khi tạo Shipping Option | Provider.`calculatePrice()` gọi API GHN/GHTK | **Giá ship động** — phụ thuộc cân nặng, khoảng cách |

> [!IMPORTANT]
> Với GHN Provider của chúng ta, **luôn dùng Calculated** — vì phí ship phụ thuộc vào từng đơn cụ thể.

---

## 4. ShipStation là gì? — So sánh với GHN Provider

| Tiêu chí | GHN Provider (Chúng ta) | ShipStation |
|---|---|---|
| **Bản chất** | Tích hợp **trực tiếp** 1 nhà vận chuyển (GHN API) | **Nền tảng trung gian** (aggregator) kết nối 100+ nhà vận chuyển (FedEx, UPS, DHL, USPS…) |
| **Tính phí** | Gọi GHN `/v2/shipping-order/fee` | Gọi ShipStation API `/shipments/getrates` |
| **Tạo vận đơn** | Gọi GHN `/v2/shipping-order/create` | Gọi ShipStation `/orders` + `/labels` |
| **Tracking** | GHN webhook hoặc polling `/v2/shipping-order/detail` | ShipStation webhook callback |
| **Phạm vi** | Chỉ Việt Nam | Toàn cầu |
| **Cần tài khoản** | API Token + Shop ID từ GHN | API Key + Secret từ ShipStation |
| **Giá tiền** | API miễn phí, chỉ trả cước vận chuyển | ShipStation tính phí subscription + cước carrier |

> [!TIP]
> ShipStation **KHÔNG thay thế** GHN Provider. Nó là mô hình tham khảo kiến trúc Fulfillment Provider trong Medusa.
> Nếu sau này cần ship quốc tế, ta có thể thêm 1 ShipStation Provider song song với GHN Provider.

---

## 5. Vòng Đời Đầy Đủ — Từ Checkout đến Giao Hàng Thành Công

```
[1] Khách nhập địa chỉ       ──→ Cart.shipping_address (+ metadata ghn_district_id)
          │
[2] Storefront gọi API       ──→ GET /store/shipping-options?cart_id=xxx
    lấy shipping options            Medusa gọi Provider.calculatePrice() cho mỗi option
          │
[3] Khách chọn option        ──→ POST /store/carts/:id/shipping-methods
    (VD: GHN Tiêu Chuẩn)          Medusa tạo ShippingMethod gắn vào Cart
          │
[4] Khách thanh toán          ──→ POST /store/carts/:id/complete
    (complete cart)                 Cart → Order (ShippingMethod được copy sang Order)
          │
[5] Admin tạo fulfillment    ──→ POST /admin/orders/:id/fulfillments
    (Create Fulfillment)           Medusa gọi Provider.createFulfillment()
          │                        GHN trả về order_code → FulfillmentLabel
[6] Admin in phiếu giao      ──→ Mở label_url in phiếu A5
          │
[7] Shipper lấy hàng giao    ──→ GHN xử lý giao hàng
          │
[8] Tracking cập nhật        ──→ GHN webhook / polling → cập nhật Fulfillment status
          │
[9] Giao thành công           ──→ Fulfillment.shipped_at được set
```

---

## 6. Các Bảng DB Cốt Lõi Medusa (Chỉ tham khảo, KHÔNG phải tự tạo)

> [!NOTE]
> Tất cả các bảng dưới đây đã được **Medusa Core tạo sẵn** qua migration.
> Chúng ta **KHÔNG tạo migration** cho chúng. Chỉ cần hiểu cấu trúc để biết cách tương tác.

| Bảng | Mối quan hệ | Ghi chú |
|---|---|---|
| `fulfillment_provider` | Thuộc `fulfillment_set` | ID = `fp_ghn_ghn` |
| `fulfillment_set` | Thuộc `stock_location` | Link qua `stock_location_fulfillment_set` |
| `service_zone` | Thuộc `fulfillment_set` | Chứa danh sách GeoZone |
| `geo_zone` | Thuộc `service_zone` | `country_code`, `province_code`, `city` |
| `shipping_option` | Thuộc `service_zone` + `fulfillment_provider` | `price_type: "calculated"` hoặc `"flat"` |
| `shipping_option_rule` | Thuộc `shipping_option` | Điều kiện hiển thị (VD: min order > 500k) |
| `fulfillment` | Thuộc Order | Chứa `data` (ghn_order_code), `shipped_at`, `canceled_at` |
| `fulfillment_item` | Thuộc `fulfillment` | `line_item_id`, `quantity` |
| `fulfillment_label` | Thuộc `fulfillment` | `tracking_number`, `tracking_url`, `label_url` |
