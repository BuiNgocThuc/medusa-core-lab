# Tóm Tắt Lịch Sử Triển Khai GHN Fulfillment Provider — Medusa v2

Tài liệu này ghi lại toàn bộ quá trình nghiên cứu, thiết kế kiến trúc, giải quyết vấn đề và tiến độ thực tế từ khi bắt đầu tích hợp **Giao Hàng Nhanh (GHN)** vào Medusa v2.

---

## 1. Điểm Xuất Phát & Phân Tích Hiện Trạng Medusa v2

Khi đặt bài toán *"Muốn tích hợp Giao Hàng Nhanh vào Medusa v2 thì cần làm gì, cái gì đã có sẵn, cái gì bắt buộc phải viết mới?"*, hệ thống đã được phân tích và bóc tách rõ ràng:

### 1.1 Những gì Medusa v2 ĐÃ CÓ SẴN (Không cần làm):
- **Cơ sở dữ liệu (Database Models):** `FulfillmentSet`, `ServiceZone`, `GeoZone`, `ShippingOption`, `ShippingProfile`, `Fulfillment`, `FulfillmentItem`, `FulfillmentLabel`, `ShippingMethod`... đã được Medusa dựng sẵn và migration tự động.
- **Quy trình nghiệp vụ (Core Workflows):** `listShippingOptionsForCartWorkflow` (tính giá ship), `addShippingMethodToCartWorkflow` (lưu cước vào giỏ), `createOrderFulfillmentWorkflow` (tạo vận đơn), `cancelFulfillmentWorkflow` (hủy vận đơn).
- **Giao diện quản trị (Admin Dashboard):** Menu quản lý kho (*Stock Locations*), gán provider vào kho, thiết lập khu vực giao hàng (*Service Zones*), tạo đơn vận chuyển từ Order, in nhãn, hủy fulfillment.

### 1.2 Những gì BẮT BUỘC PHẢI LÀM:
- Xây dựng **Module Fulfillment Provider riêng cho GHN** kế thừa `AbstractFulfillmentProviderService`.
- Đăng ký provider vào mảng `modules` trong `medusa-config.ts`.
- Giải quyết bài toán **địa giới hành chính Việt Nam** (Medusa mặc định dùng chuỗi text tự do, trong khi GHN yêu cầu mã ID số nguyên).

---

## 2. Kế Hoạch Triển Khai (Implementation Plan)

Một bản kế hoạch gồm 5 giai đoạn đã được xác lập:
- **Giai đoạn 1:** Chuẩn bị môi trường, API Token & Shop ID sandbox GHN.
- **Giai đoạn 2:** Viết trọn vẹn bộ mã nguồn module GHN tại `src/modules/giao-hang-nhanh`.
- **Giai đoạn 3:** Đăng ký module vào `medusa-config.ts` và thiết lập trên Admin Dashboard.
- **Giai đoạn 4:** Xử lý ánh xạ địa chỉ Tỉnh/Huyện/Xã tại Storefront & tích hợp tính phí theo thời gian thực.
- **Giai đoạn 5:** Tạo Webhook nhận trạng thái shipper giao hàng & kiểm thử End-to-End.

---

## 3. Quá Trình Hiện Thực Hóa Module Backend

Module `apps/backend/src/modules/giao-hang-nhanh/` đã được khởi tạo hoàn chỉnh:

1. **`types.ts`:**
   - Định nghĩa DTOs cho các gói dịch vụ GHN, cước phí, đơn vận chuyển, danh mục địa phương.
   - Định nghĩa options cấu hình module: `token`, `shopId`, `fromDistrictId`, `fromWardCode`, `endpoint`, `mockEnabled`, `requiredNote`.
2. **`client.ts` (`GhnClient`):**
   - Đóng gói các cuộc gọi REST API với GHN (gửi kèm header `Token` và `ShopId`).
   - Tích hợp sẵn **Mock Mode** (tự động giả lập cước và mã vận đơn nếu chưa điền key thật, giúp dev local không bị gián đoạn).
3. **`service.ts` (`GiaoHangNhanhProviderService`):**
   - Kế thừa `AbstractFulfillmentProviderService`, định danh `static identifier = "ghn"`.
   - `getFulfillmentOptions`: Cung cấp 3 gói cước (Standard, Fast, Express).
   - `calculatePrice`: Tính cước động theo trọng lượng giỏ hàng và địa chỉ nhận.
   - `createFulfillment`: Gọi GHN sinh mã vận đơn (`order_code`) và URL in phiếu gửi hàng A5 (`label_url`).
   - `cancelFulfillment`: Hủy vận đơn trên GHN.
4. **`index.ts`:**
   - Export theo chuẩn `ModuleProvider(Modules.FULFILLMENT, { services: [GiaoHangNhanhProviderService] })`.
5. **`medusa-config.ts`:**
   - Đăng ký đồng thời cả provider `manual` và `ghn` vào module `@medusajs/medusa/fulfillment`.
   - Kiểm tra `tsc --noEmit` đạt chuẩn **Exit code 0 (Không còn bất kỳ lỗi type nào)**.

---

## 4. Bước Ngoặt: "Địa Chỉ Định Dạng Mới" (`is_new_to_address: true`)

Qua tra cứu tài liệu cập nhật của GHN (áp dụng sau 01/07/2025):
- **Phát hiện mới:** GHN đã ra mắt định dạng địa chỉ mới cho API Tạo Đơn (`POST /v2/shipping-order/create`). Khi gửi `is_new_to_address: true` kèm `to_address`, `to_province_name`, `to_ward_name`, shop **không cần truyền `to_district_id` hay `to_ward_code`**.
- **Cập nhật mã nguồn ngay lập tức:**
  - Nâng cấp `service.ts` thành **Cơ chế Auto-Detect thông minh**:
    - Nếu đơn có sẵn `metadata.ghn_district_id` & `metadata.ghn_ward_code`: Tự dùng **Định dạng truyền thống**.
    - Nếu khách chỉ nhập text thông thường (`province`, `city`, `ward`): Tự kích hoạt `is_new_to_address: true` theo **Định dạng mới**.

---

## 5. Điểm Nghẽn Của API Tính Phí & Giải Pháp Master Data

Khi xác minh sâu hơn với AI trên tài liệu GHN:
- **Phát hiện mâu thuẫn cốt lõi giữa 2 API:**
  - API Tạo đơn (`/v2/shipping-order/create`): **Hỗ trợ** định dạng mới không cần `district_id`.
  - API Tính phí (`/v2/shipping-order/fee`): **CHƯA hỗ trợ** định dạng mới, vẫn **bắt buộc** phải có `to_district_id` (Int) và `to_ward_code` (String).
- **Hệ quả thực tế:** Nếu khách hàng đang ở bước thanh toán (Checkout) mà không có `to_district_id`, API tính phí của GHN sẽ từ chối báo giá.
- **Giải pháp chuẩn hóa đã thống nhất:**
  1. Sử dụng bộ **Master Data API** của GHN (Tỉnh → Huyện → Xã).
  2. Storefront hiển thị danh mục địa phương để khách hàng chọn; hệ thống tự lưu `ghn_province_id`, `ghn_district_id`, `ghn_ward_code` vào `metadata` của địa chỉ giỏ hàng.
  3. Khi có mã số trong metadata, API tính phí chạy trơn tru 100%. Nếu khách chưa kịp chọn, hệ thống dùng fallback sàn (30.000 VNĐ) để không làm nghẽn checkout.

---

## 6. Trạng Thái Hiện Tại & Các Bước Tiếp Theo

| Thành phần | Trạng thái | Vị trí file |
|---|---|---|
| Module Provider GHN | **Hoàn thành 100%** | `apps/backend/src/modules/giao-hang-nhanh/` |
| Cấu hình Backend | **Hoàn thành 100%** | `apps/backend/medusa-config.ts` |
| Tài liệu đặc tả kỹ thuật | **Hoàn thành 100%** | [spec.md](file:///home/ubuntu/Githubbb/github-medusa-core-v2.20/medusa-core-lab/my-medusa-store/apps/backend/src/modules/giao-hang-nhanh/spec.md) |
| Biên dịch TypeScript | **Pass (Exit code 0)** | Đã verify với `tsc --noEmit` |

### Việc cần làm tiếp theo:
1. **Backend:** Tạo 3 API route trung gian (`/store/ghn/provinces`, `/store/ghn/districts`, `/store/ghn/wards`) để Storefront tra cứu địa phương an toàn mà không lộ API Token GHN.
2. **Storefront:** Gắn selector Tỉnh / Huyện / Xã vào form nhập địa chỉ giao hàng tại checkout.
