# 🚀 SHIPPING IMPLEMENTATION PLAN — GHN + Medusa v2

> **Tổng hợp tất cả các phase, ưu tiên, và trạng thái triển khai.**
> Cập nhật lần cuối: 2026-09-27

---

## Tổng Quan Kiến Trúc

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SHIPPING PIPELINE                              │
│                                                                         │
│  ┌──────────┐   ┌───────────┐   ┌──────────┐   ┌──────────┐           │
│  │ Phase 1  │──→│  Phase 2  │──→│ Phase 3  │──→│ Phase 4  │──→ Phase 5│
│  │ Admin    │   │ API Routes│   │Storefront│   │Fulfillment│   Tracking│
│  │ Setup    │   │ MasterData│   │    UI    │   │ Create   │           │
│  └──────────┘   └───────────┘   └──────────┘   └──────────┘           │
│   ✅ DONE        🔴 TODO         🔴 TODO        ✅ CODE DONE   🔴 TODO │
│   (No-code)      (Backend)       (Frontend)     (Test needed)  (Backend)│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase Breakdown

### Phase 1: Admin Setup ✅ DONE
> **Spec:** [01-PHASE-ADMIN-SETUP.md](file:///e:/Code/Smartor_Code/MEDUSA-CORE-LAB/medusa-core-lab/my-medusa-store/apps/backend/src/modules/giao-hang-nhanh/specs/01-PHASE-ADMIN-SETUP.md)

| Task | Status | Notes |
|---|---|---|
| Module Provider code | ✅ Done | `service.ts`, `client.ts`, `types.ts` |
| Register in `medusa-config.ts` | ✅ Done | L191-L222 |
| TypeScript check | ✅ Pass | `tsc --noEmit` exit 0 |
| Admin Dashboard config | ⚡ Manual | Cần click setup trên UI |

**Output:** GHN provider sẵn sàng, cần setup trên Admin UI.

---

### Phase 2: API Routes — Master Data 🔴 TODO (Ưu tiên 1)
> **Spec:** [02-PHASE-API-MASTERDATA.md](file:///e:/Code/Smartor_Code/MEDUSA-CORE-LAB/medusa-core-lab/my-medusa-store/apps/backend/src/modules/giao-hang-nhanh/specs/02-PHASE-API-MASTERDATA.md)

| Task | Effort | Dependency |
|---|---|---|
| `GET /store/ghn/provinces` | 🟢 Small | GhnClient.getProvinces() ✅ |
| `GET /store/ghn/districts` | 🟢 Small | GhnClient.getDistricts() ✅ |
| `GET /store/ghn/wards` | 🟢 Small | GhnClient.getWards() ✅ |
| Middleware CORS config | 🟢 Small | — |
| Caching (Redis/in-memory) | 🟡 Medium | Redis config ✅ |

**Output:** 3 endpoints mới, Storefront có thể fetch master data.

---

### Phase 3: Storefront UI 🔴 TODO (Ưu tiên 2)
> **Spec:** [03-PHASE-STOREFRONT-UI.md](file:///e:/Code/Smartor_Code/MEDUSA-CORE-LAB/medusa-core-lab/my-medusa-store/apps/backend/src/modules/giao-hang-nhanh/specs/03-PHASE-STOREFRONT-UI.md)

| Task | Effort | Dependency |
|---|---|---|
| GHN Address Selector component | 🟡 Medium | Phase 2 APIs |
| Integrate vào checkout form | 🟡 Medium | Address Selector |
| Save metadata vào cart | 🟢 Small | — |
| Shipping Option display | 🟢 Small | Phase 1 Admin setup |
| Chọn shipping method | 🟢 Small | — |

**Output:** Khách chọn Tỉnh/Huyện/Xã, thấy giá ship GHN, chọn method.

---

### Phase 4: Fulfillment Create ✅ CODE DONE (Cần Test)
> **Spec:** [04-PHASE-FULFILLMENT-CREATE.md](file:///e:/Code/Smartor_Code/MEDUSA-CORE-LAB/medusa-core-lab/my-medusa-store/apps/backend/src/modules/giao-hang-nhanh/specs/04-PHASE-FULFILLMENT-CREATE.md)

| Task | Status | Notes |
|---|---|---|
| `createFulfillment()` | ✅ Done | Auto-detect address format |
| `cancelFulfillment()` | ✅ Done | Gọi GHN cancel API |
| Label generation | ✅ Done | A5/80x80/52x70 |
| Mock mode | ✅ Done | Mock order_code + label |
| `createReturnFulfillment()` | ⚠️ Stub | Cần implement sau |
| E2E Test | 🔴 TODO | Cần Phase 1-3 xong trước |

**Output:** Admin tạo fulfillment → GHN sinh mã vận đơn.

---

### Phase 5: Tracking 🔴 TODO (Ưu tiên 3)
> **Spec:** [05-PHASE-TRACKING.md](file:///e:/Code/Smartor_Code/MEDUSA-CORE-LAB/medusa-core-lab/my-medusa-store/apps/backend/src/modules/giao-hang-nhanh/specs/05-PHASE-TRACKING.md)

| Task | Effort | Dependency |
|---|---|---|
| Webhook endpoint | 🟡 Medium | Public URL / tunnel |
| Status mapping GHN → Medusa | 🟢 Small | — |
| Polling scheduled job | 🟡 Medium | — |
| `getOrderDetail()` in client | 🟢 Small | — |
| Storefront tracking UI | 🟡 Medium | Order response |

**Output:** Tracking tự động cập nhật, khách thấy trạng thái giao hàng.

---

## Thứ Tự Triển Khai Khuyến Nghị

```
WEEK 1:  Phase 1 (Admin Setup)  → Manual config, 30 phút
         Phase 2 (API Routes)   → Code 3 endpoints, ~2-3 giờ

WEEK 2:  Phase 3 (Storefront)   → Component + Integration, ~1-2 ngày
         Test E2E checkout flow

WEEK 3:  Phase 4 Testing        → Test tạo fulfillment real GHN (cần key thật)
         Phase 5 (Tracking)     → Webhook + Polling, ~1 ngày

WEEK 4:  Polish + Edge cases    → Error handling, retry, logging
         Production checklist   → Đổi endpoint sang prod GHN
```

---

## File Index — Specs Folder

| File | Nội dung |
|---|---|
| [00-GLOSSARY.md](file:///e:/Code/Smartor_Code/MEDUSA-CORE-LAB/medusa-core-lab/my-medusa-store/apps/backend/src/modules/giao-hang-nhanh/specs/00-GLOSSARY.md) | Bảng thuật ngữ, khái niệm, bảng DB |
| [01-PHASE-ADMIN-SETUP.md](file:///e:/Code/Smartor_Code/MEDUSA-CORE-LAB/medusa-core-lab/my-medusa-store/apps/backend/src/modules/giao-hang-nhanh/specs/01-PHASE-ADMIN-SETUP.md) | Phase 1: Cấu hình Admin Dashboard |
| [02-PHASE-API-MASTERDATA.md](file:///e:/Code/Smartor_Code/MEDUSA-CORE-LAB/medusa-core-lab/my-medusa-store/apps/backend/src/modules/giao-hang-nhanh/specs/02-PHASE-API-MASTERDATA.md) | Phase 2: API routes master data VN |
| [03-PHASE-STOREFRONT-UI.md](file:///e:/Code/Smartor_Code/MEDUSA-CORE-LAB/medusa-core-lab/my-medusa-store/apps/backend/src/modules/giao-hang-nhanh/specs/03-PHASE-STOREFRONT-UI.md) | Phase 3: Storefront UI integration |
| [04-PHASE-FULFILLMENT-CREATE.md](file:///e:/Code/Smartor_Code/MEDUSA-CORE-LAB/medusa-core-lab/my-medusa-store/apps/backend/src/modules/giao-hang-nhanh/specs/04-PHASE-FULFILLMENT-CREATE.md) | Phase 4: Tạo vận đơn, in phiếu, hủy |
| [05-PHASE-TRACKING.md](file:///e:/Code/Smartor_Code/MEDUSA-CORE-LAB/medusa-core-lab/my-medusa-store/apps/backend/src/modules/giao-hang-nhanh/specs/05-PHASE-TRACKING.md) | Phase 5: Tracking webhook + polling |
| [HISTORY.md](file:///e:/Code/Smartor_Code/MEDUSA-CORE-LAB/medusa-core-lab/my-medusa-store/apps/backend/src/modules/giao-hang-nhanh/specs/HISTORY.md) | Lịch sử triển khai |
| [spec.md](file:///e:/Code/Smartor_Code/MEDUSA-CORE-LAB/medusa-core-lab/my-medusa-store/apps/backend/src/modules/giao-hang-nhanh/specs/spec.md) | Spec gốc ban đầu (legacy) |

---

## Về ShipStation — Kết Luận

Sau khi đọc [tài liệu ShipStation integration](https://docs.medusajs.com/resources/integrations/guides/shipstation):

- ShipStation là **fulfillment aggregator** cho thị trường quốc tế (FedEx, UPS, DHL, USPS…)
- Pattern kiến trúc **tương tự** với GHN Provider (cùng extend `AbstractFulfillmentProviderService`)
- **Không cần thiết** cho bài toán VN hiện tại
- **Hữu ích tham khảo:** Cách ShipStation handle webhook callback, status mapping, label generation
- **Tương lai:** Nếu cần ship quốc tế, thêm ShipStation Provider **song song** với GHN Provider

> [!TIP]
> ShipStation guide là **mô hình tham khảo tốt**, không phải thứ ta cần tích hợp ngay.
