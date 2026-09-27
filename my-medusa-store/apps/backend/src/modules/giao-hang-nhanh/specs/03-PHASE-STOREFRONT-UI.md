# Phase 3 — Storefront: Address Selector & Shipping Option UI

> **Mục tiêu:** Tích hợp UI chọn Tỉnh/Huyện/Xã vào Storefront checkout, hiển thị shipping options với giá GHN.

---

## 1. Phạm Vi

Storefront (Next.js Starter) cần thay đổi ở 2 nơi:

1. **Form địa chỉ giao hàng** — Thêm 3 cascading dropdown (Tỉnh → Huyện → Xã)
2. **Hiển thị Shipping Options** — Show giá `Calculated` từ GHN

---

## 2. Component: GHN Address Selector

### 2.1 Vị Trí Integration

```
apps/storefront/src/modules/checkout/
├── components/
│   ├── shipping-address/        # ← Sửa ở đây
│   │   └── index.tsx
│   └── ghn-address-selector/    # ← Component MỚI
│       └── index.tsx
└── templates/
    └── checkout-form/
```

### 2.2 Behavior

```
Bước 1: Khách chọn Country = Vietnam
        → Hiện 3 dropdown: Tỉnh/Thành — Quận/Huyện — Phường/Xã
        
Bước 2: Khách chọn Tỉnh (VD: Hồ Chí Minh)
        → Fetch districts từ /store/ghn/districts?province_id=202
        → Tự động set `province` = "Hồ Chí Minh"
        
Bước 3: Khách chọn Quận/Huyện (VD: Quận 1)
        → Fetch wards từ /store/ghn/wards?district_id=2009
        → Tự động set `city` = "Quận 1"
        
Bước 4: Khách chọn Phường/Xã (VD: Phường Bến Nghé)
        → Lưu metadata vào cart:
          {
            "ghn_province_id": 202,
            "ghn_district_id": 2009,
            "ghn_ward_code": "20308",
            "ghn_province_name": "Hồ Chí Minh",
            "ghn_district_name": "Quận 1",
            "ghn_ward_name": "Phường Bến Nghé"
          }
```

### 2.3 API Call để lưu metadata

```typescript
// Khi khách chọn xong Phường/Xã:
await medusa.store.cart.update(cartId, {
  shipping_address: {
    ...existingAddress,
    province: "Hồ Chí Minh",
    city: "Quận 1",
    metadata: {
      ghn_province_id: 202,
      ghn_district_id: 2009,
      ghn_ward_code: "20308",
      ghn_province_name: "Hồ Chí Minh",
      ghn_district_name: "Quận 1",
      ghn_ward_name: "Phường Bến Nghé",
    }
  }
})
```

---

## 3. Hiển Thị Shipping Options

### 3.1 Flow

```
Sau khi lưu địa chỉ → Storefront gọi:
  GET /store/shipping-options?cart_id=xxx

Medusa tự động:
  1. Tìm tất cả Service Zones match với country_code "vn"
  2. Lấy tất cả Shipping Options trong zone đó
  3. Với mỗi option có price_type = "calculated":
     → Gọi Provider.calculatePrice()
     → GHN Provider đọc metadata.ghn_district_id từ cart
     → Gọi GHN API /v2/shipping-order/fee
     → Trả về giá VND
  4. Trả về danh sách options + giá

Storefront hiển thị:
  ┌─────────────────────────────────────────┐
  │ ○ Giao Hàng Nhanh (Tiêu Chuẩn)  32,500₫ │
  │ ○ Giao Hàng Nhanh (Hỏa Tốc)     55,000₫ │
  │ ○ Giao Thủ Công                   50,000₫ │
  └─────────────────────────────────────────┘
```

### 3.2 Chọn Shipping Method

```typescript
// Khi khách click chọn 1 option:
await medusa.store.cart.addShippingMethod(cartId, {
  option_id: selectedOption.id,
  // data sẽ tự động được truyền từ option
})
```

---

## 4. Edge Cases

| Case | Xử lý |
|---|---|
| Country ≠ VN | Không show GHN dropdown, chỉ show input text thông thường |
| Chưa chọn hết Tỉnh/Huyện/Xã | Hiển thị phí ship tạm tính (30.000₫ fallback) |
| GHN API lỗi | Hiển thị phí fallback (35.000₫), log lỗi |
| Khách đổi tỉnh | Reset Huyện + Xã, re-fetch districts |
| Nhiều Stock Location | Medusa tự chọn location phù hợp nhất theo Service Zone |

---

## 5. Acceptance Criteria

- [ ] Dropdown Tỉnh/Huyện/Xã hiển thị khi country = VN
- [ ] Cascading select hoạt động (chọn tỉnh → load huyện → chọn huyện → load xã)
- [ ] Sau chọn xong xã, metadata được lưu vào cart.shipping_address
- [ ] Shipping Options hiển thị với giá calculated từ GHN
- [ ] Khách có thể chọn shipping method và tiếp tục thanh toán
- [ ] UX mượt: loading state cho mỗi dropdown, error handling
