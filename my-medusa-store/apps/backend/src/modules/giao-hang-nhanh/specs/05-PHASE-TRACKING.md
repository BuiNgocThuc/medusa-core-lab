# Phase 5 — Tracking: Webhook, Polling & Cập Nhật Trạng Thái Vận Đơn

> **Mục tiêu:** Sau khi tạo vận đơn, hệ thống cần biết khi nào shipper lấy hàng, đang giao, giao thành công, hay giao thất bại → cập nhật vào Medusa.

---

## 1. Tracking Hoạt Động Như Thế Nào?

Có **2 cách** để nhận trạng thái đơn vận chuyển từ GHN:

| Cách | Cơ chế | Ưu điểm | Nhược điểm |
|---|---|---|---|
| **Webhook** (Khuyến nghị) | GHN gọi URL callback của ta khi có thay đổi | Real-time, không tốn request | Cần public URL, setup trên GHN portal |
| **Polling** | Ta gọi GHN API định kỳ | Đơn giản, không cần public URL | Tốn request, delay |

---

## 2. Cách 1: GHN Webhook (Khuyến Nghị)

### 2.1 Đăng Ký Webhook trên GHN Portal
1. Đăng nhập https://dev.ghn.vn (hoặc https://ghn.vn cho production)
2. Vào **Cài đặt** → **Webhook**
3. Thêm URL callback: `https://your-domain.com/hooks/fulfillment/ghn`

### 2.2 API Route Nhận Webhook

```
POST /hooks/fulfillment/ghn
```

**File cần tạo:**
```
apps/backend/src/api/hooks/fulfillment/ghn/
└── route.ts
```

### 2.3 Payload GHN gửi đến (Ví dụ)

```json
{
  "CODAmount": 0,
  "CODTransferDate": "",
  "ClientOrderCode": "ORD-1234",
  "ConvertedWeight": 600,
  "Description": "",
  "Fee": {
    "CODFee": 0,
    "CODFailedFee": 0,
    "InsuranceFee": 0,
    "MainServiceFee": 32500,
    "ReturnFee": 0,
    "StationDOFee": 0,
    "StationPUFee": 0
  },
  "Height": 10,
  "IsPartialReturn": false,
  "Length": 20,
  "Note": "",
  "OrderCode": "LR88Z9",
  "PaymentType": 1,
  "Reason": "",
  "ReasonCode": "",
  "ShopID": 12345,
  "Status": "delivered",
  "Type": "switch_status",
  "UpdateDate": "2026-09-28T14:30:00+07:00",
  "Warehouse": "",
  "Weight": 600,
  "Width": 15
}
```

### 2.4 Bảng Mapping Trạng Thái GHN → Medusa

| GHN Status | Ý nghĩa | Action trong Medusa |
|---|---|---|
| `ready_to_pick` | Đang chờ shipper lấy hàng | Update fulfillment.data.status |
| `picking` | Shipper đang đến lấy hàng | Update fulfillment.data.status |
| `picked` | Shipper đã lấy hàng | Update fulfillment.data.status |
| `storing` | Hàng đang ở kho trung chuyển | Update fulfillment.data.status |
| `transporting` | Đang vận chuyển | Update fulfillment.data.status |
| `sorting` | Đang phân loại | Update fulfillment.data.status |
| `delivering` | Shipper đang giao hàng | Update fulfillment.data.status |
| `delivered` | **Giao thành công** ✅ | **Set fulfillment.shipped_at** + emit event |
| `delivery_fail` | Giao thất bại | Update fulfillment.data.status + ghi reason |
| `waiting_to_return` | Chờ trả hàng | Update fulfillment.data.status |
| `return` | Đang trả hàng về | Update fulfillment.data.status |
| `returned` | Đã trả hàng về kho | Trigger return fulfillment flow |
| `cancel` | Đã hủy | Set fulfillment.canceled_at |
| `exception` | Bất thường | Log + alert admin |

### 2.5 Mẫu Code Webhook Handler

```typescript
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const payload = req.body as any

  const orderCode = payload.OrderCode     // VD: "LR88Z9"
  const status = payload.Status           // VD: "delivered"
  const clientOrderCode = payload.ClientOrderCode  // VD: "ORD-1234"

  const logger = req.scope.resolve("logger")
  logger.info(`[GHN Webhook] Order ${orderCode} → Status: ${status}`)

  // TODO: Tìm Fulfillment bằng ghn_order_code
  // TODO: Cập nhật status vào fulfillment.data
  // TODO: Nếu status === "delivered" → gọi workflow đánh dấu shipped

  // GHN mong đợi HTTP 200
  return res.status(200).json({ success: true })
}
```

> [!IMPORTANT]
> **Vấn đề:** Medusa v2 lưu `ghn_order_code` trong `fulfillment.data` (JSON column).
> Để tìm fulfillment theo `order_code`, ta cần query qua Fulfillment Module Service:
> ```typescript
> const fulfillmentModuleService = req.scope.resolve("fulfillment")
> // Lọc fulfillments có data.ghn_order_code === orderCode
> ```

---

## 3. Cách 2: Polling (Backup)

### 3.1 GHN API Tra Cứu Đơn

```
POST /v2/shipping-order/detail
Headers: Token, ShopId
Body: { "order_code": "LR88Z9" }
```

**Response:**
```json
{
  "order_code": "LR88Z9",
  "status": "delivering",
  "log": [
    { "status": "ready_to_pick", "updated_date": "..." },
    { "status": "picked", "updated_date": "..." },
    { "status": "delivering", "updated_date": "..." }
  ]
}
```

### 3.2 Scheduled Job Polling

```typescript
// apps/backend/src/jobs/ghn-tracking-sync.ts
import { MedusaContainer } from "@medusajs/framework/types"

export default async function ghnTrackingSync(container: MedusaContainer) {
  const logger = container.resolve("logger")
  const fulfillmentService = container.resolve("fulfillment")

  // 1. Lấy tất cả fulfillments chưa shipped, có provider = "ghn"
  // 2. Cho mỗi fulfillment, gọi GHN API /v2/shipping-order/detail
  // 3. Cập nhật status nếu có thay đổi
  // 4. Nếu status === "delivered" → đánh dấu shipped
}

export const config = {
  name: "ghn-tracking-sync",
  schedule: "*/15 * * * *", // Mỗi 15 phút
}
```

---

## 4. Client Method Cần Thêm (client.ts)

```typescript
// Thêm vào GhnClient:

interface GhnOrderDetail {
  order_code: string
  status: string
  log: Array<{
    status: string
    updated_date: string
  }>
  // ... thêm fields khác
}

async getOrderDetail(orderCode: string): Promise<GhnOrderDetail> {
  if (this.mockEnabled || !this.token) {
    return {
      order_code: orderCode,
      status: "delivering",
      log: [{ status: "delivering", updated_date: new Date().toISOString() }],
    }
  }

  return await this.request<GhnOrderDetail>(
    "/v2/shipping-order/detail",
    "POST",
    { order_code: orderCode },
    true
  )
}
```

---

## 5. Storefront Tracking UI

### 5.1 Trang Tracking cho Khách

```
/account/orders/:orderId → hiển thị tracking info
```

**Dữ liệu cần hiển thị:**
- Mã vận đơn: `LR88Z9`
- Link tra cứu GHN: `https://donhang.ghn.vn/?order_code=LR88Z9` (mở tab mới)
- Trạng thái hiện tại: "Đang giao hàng" (map từ GHN status)
- Timeline các bước tracking

### 5.2 API Để Storefront Lấy Tracking

Medusa đã có sẵn trong Order response:
```json
{
  "order": {
    "fulfillments": [
      {
        "data": { "ghn_order_code": "LR88Z9" },
        "labels": [
          {
            "tracking_number": "LR88Z9",
            "tracking_url": "https://donhang.ghn.vn/?order_code=LR88Z9"
          }
        ],
        "shipped_at": null  // null = chưa giao xong
      }
    ]
  }
}
```

---

## 6. Cấu Trúc File Cần Tạo

```
apps/backend/src/
├── api/hooks/fulfillment/ghn/
│   └── route.ts                    # Webhook receiver
├── jobs/
│   └── ghn-tracking-sync.ts       # Scheduled polling (backup)
└── modules/giao-hang-nhanh/
    └── client.ts                    # Thêm getOrderDetail()
```

---

## 7. Quyết Định Thiết Kế

| Quyết định | Lựa chọn | Lý do |
|---|---|---|
| Webhook vs Polling | **Cả hai** | Webhook cho real-time, polling làm backup |
| Lưu tracking history | Trong `fulfillment.data.tracking_log` | JSON column, không cần bảng riêng |
| "Delivered" action | Set `shipped_at` + emit event | Medusa convention |
| Webhook security | Validate ShopID + IP whitelist | GHN không sign webhook |

---

## 8. Acceptance Criteria

- [ ] Webhook endpoint nhận được callback từ GHN (test bằng curl)
- [ ] Trạng thái fulfillment cập nhật khi GHN gửi webhook
- [ ] Khi GHN status = "delivered", fulfillment.shipped_at được set
- [ ] Polling job chạy mỗi 15 phút (backup)
- [ ] Storefront hiển thị tracking_number và tracking_url trên order detail
- [ ] Khách có thể click tracking_url mở trang GHN tra cứu
- [ ] `getOrderDetail()` hoạt động trong GhnClient
