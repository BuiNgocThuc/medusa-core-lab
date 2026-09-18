# Medusa v2 Caching Module — Kiến Trúc, So Sánh & Hướng Dẫn Chi Tiết

Tài liệu tổng hợp toàn diện về **Caching Module** trong Medusa v2: Bối cảnh ra đời từ phiên bản **v2.11.0**, so sánh với **Cache Module cũ**, phân tích các cơ chế cốt lõi bên dưới source code (Tag-based, Hash key, Auto-invalidation, Stampede protection), và hướng dẫn cấu hình, sử dụng thực tế.

---

## 1. Giới thiệu & Bối cảnh ra đời (Medusa v2.11.0)

Trước phiên bản **Medusa v2.11.0**, Medusa sử dụng **Cache Module cũ** (`@medusajs/cache-inmemory` và `@medusajs/cache-redis`). 
- **Hạn chế của module cũ:** Chỉ hoạt động như một kho lưu trữ Key-Value đơn thuần (`cache.get(key)`, `cache.set(key, val)`, `cache.invalidate(key)`). Lập trình viên phải tự quản lý việc sinh key và **phải tự nhớ để xóa từng key thủ công** mỗi khi dữ liệu thay đổi.
- **Sự ra đời của Caching Module (v2.11.0):** Medusa chính thức giới thiệu **Caching Module** hoàn toàn mới (`@medusajs/caching` và provider `@medusajs/caching-redis`), đánh dấu bước nhảy vọt về công nghệ với **Tag-based Caching** và **Tự động vô hiệu hoá cache theo sự kiện CRUD (Automatic Invalidation)**.

> [!IMPORTANT]
> Cache Module cũ hiện đã bị **Deprecated**. Caching Module mới là chuẩn mực duy nhất được tích hợp sâu vào toàn bộ hệ thống Core của Medusa v2 (Query Graph, Link Modules, Workflows, Cart, Checkout).

---

## 2. Bảng So Sánh: Caching Module (Mới) vs Cache Module (Cũ)

| Tiêu chí | Cache Module (Cũ - Deprecated) | Caching Module (Mới - từ v2.11.0) |
| :--- | :--- | :--- |
| **Package** | `@medusajs/cache-inmemory`, `@medusajs/cache-redis` | `@medusajs/caching`, `@medusajs/caching-redis` |
| **Mô hình lưu trữ** | Key-Value đơn giản | **Key-Value kết hợp Tag-based (Đa chiều)** |
| **Cơ chế Xóa Cache** | **Thủ công 100%**: Phải tự nhớ chính xác key để gọi `invalidate(key)`. Rất dễ sót cache gây lỗi lệch dữ liệu. | **Tự động 100% (Automatic Invalidation)**: Tự lắng nghe Event Bus, tự động xóa cache khi dữ liệu bị Create/Update/Delete. |
| **Cơ chế sinh Key** | Tự ghép chuỗi string thủ công (ví dụ: `"prod_" + id`). | **Băm đối tượng thông minh (`computeKey`)**: Tự động băm object tham số query thành hash duy nhất. |
| **Độc lập thứ tự key** | Không (chuỗi JSON đảo thứ tự thuộc tính sẽ sinh key khác nhau). | **Có**: Dùng `fast-json-stable-stringify` chuẩn hóa A-Z trước khi hash. |
| **Tích hợp Query** | Không có. Phải tự bọc logic cache ngoài service. | **Tích hợp sâu**: Chỉ cần bật `{ cache: { enable: true } }` trong `query.graph` hoặc `useQueryGraphStep`. |
| **Chống sập Database (Stampede)** | Không có. | **Có (`ongoingRequests`)**: Tự động gộp hàng trăm request trùng lặp thành 1 query DB duy nhất. |
| **Quản lý quan hệ Link** | Không hỗ trợ. | Tự động invalidate khi có thao tác Attach/Detach giữa các module links. |

---

## 3. Các Cơ Chế Kỹ Thuật Đột Phá

### 3.1. Băm Khóa Thông Minh (Deterministic Key Hashing)
Trong JavaScript, 2 object có cùng thuộc tính nhưng khác thứ tự sẽ tạo ra chuỗi `JSON.stringify` khác nhau:
```js
JSON.stringify({ id: 1, title: "A" }) // '{"id":1,"title":"A"}'
JSON.stringify({ title: "A", id: 1 }) // '{"title":"A","id":1}'
```
Nếu băm chuỗi thường, hệ thống sẽ coi là 2 truy vấn khác nhau $\rightarrow$ **Cache Miss**.

**Cách Caching Module xử lý:**
Sử dụng thư viện `fast-json-stable-stringify` trước khi hash:
```ts
objectHash(input: any): string {
  const str = stringify(input) // Tự sắp xếp key theo thứ tự A-Z trước khi stringify
  return this.#hasher(str)     // Băm thành mã hash duy nhất
}
```
$\rightarrow$ Đảm bảo mọi truy vấn có cùng nội dung lọc (dù truyền thứ tự nào) đều sinh ra **cùng một Cache Key**.

---

### 3.2. Phân Loại Nhãn (Cache Tags Convention)
Caching Module dán các "nhãn" (tags) lên dữ liệu cache theo chuẩn:
- **`Entity:{id}`** (ví dụ `Product:prod_123`): Đại diện cho bản ghi duy nhất của thực thể đó.
- **`Entity:list:*`** (ví dụ `Product:list:*`): Đại diện cho mọi danh sách mảng có liên quan đến thực thể đó.

---

### 3.3. Tự Động Vô Hiệu Hóa Cache (Automatic Cache Invalidation)
Caching Module đăng ký lắng nghe toàn bộ sự kiện trên **Event Bus** (`eventBus.subscribe("*", handleEvent)`):

```text
[Admin thực hiện CRUD] 
        │
        ▼ (Phát Event qua Event Bus)
product.created / product.updated / product.deleted
        │
        ▼ (Caching Module đón bắt sự kiện)
Tự phân tích: Entity="Product", Action="updated", ID="prod_123"
        │
        ▼ (Xóa cache theo Tags tương ứng)
cacheModule.clear({ tags: ["Product:prod_123", "Product:list:*"] })
```

#### Ma trận xóa cache theo thao tác:
| Thao tác Database | Cache Tags bị xóa | Rationale |
| :--- | :--- | :--- |
| **Create (Tạo mới)** | `Entity:list:*` | Danh sách sản phẩm có thêm phần tử mới. |
| **Update (Cập nhật)** | `Entity:{id}` và `Entity:list:*` | Dữ liệu chi tiết thay đổi; đồng thời có thể làm đổi trạng thái lọc (draft $\rightarrow$ published), đổi danh mục, hoặc đổi tiêu đề hiển thị ngoài danh sách. |
| **Delete (Xóa)** | `Entity:{id}` và `Entity:list:*` | Xóa chi tiết và loại khỏi các danh sách. |
| **Restore (Khôi phục)** | `Entity:{id}` và `Entity:list:*` | Sản phẩm quay trở lại các danh sách. |
| **Attach / Detach Link** | `LinkEntity:list:*` | Quan hệ liên kết giữa 2 module thay đổi (VD: gán variant vào kho hàng). |

---

### 3.4. Cơ Chế Lazy Caching (On-Demand) vs Eager Caching
Sau khi xóa cache do có cập nhật, **hệ thống KHÔNG tự động chạy query nạp lại cache ngay lập tức**, mà hoạt động theo cơ chế **Lazy Caching (Cache-Aside)**:
1. **Lý do không nạp lại ngay (Eager):** Tránh bùng nổ tổ hợp (Combinatorial Explosion). Storefront có hàng trăm trang lọc khác nhau (trang 1, trang 2, lọc giá, lọc màu, lọc danh mục...). Nếu mỗi lần sửa 1 sản phẩm mà server tự chạy lại hàng trăm query thì CPU và Database sẽ bị quá tải (Spike) ngay lập tức.
2. **Khi nào nạp lại?** Chờ đến khi có **request tiếp theo của người dùng**. Request đầu tiên sẽ thấy Cache Miss $\rightarrow$ Query DB lấy dữ liệu mới nhất $\rightarrow$ Trả về cho khách và **lưu lại vào Cache**. Các request sau đó sẽ nhận từ Cache.

---

### 3.5. Chống Nghẽn Truy Vấn — Thundering Herd / Cache Stampede
Trong `cache-module.ts`, Medusa duy trì:
```ts
protected ongoingRequests: Map<string, Promise<any>> = new Map()
```
- **Kịch bản:** Khi một sản phẩm Hot vừa mở bán hoặc vừa hết hạn cache, 1.000 khách hàng cùng bấm F5 trong 1 giây.
- **Cơ chế xử lý:**
  - Request 1 đến: Thấy chưa có cache $\rightarrow$ Tạo `Promise` query DB và lưu vào `ongoingRequests`.
  - Request 2 đến 1.000 đến: Thấy đang có `Promise` chạy dở trong `ongoingRequests` $\rightarrow$ **Không query DB nữa**, mà đứng chờ chung kết quả của Request 1.
  - Database chỉ phải chịu **đúng 1 câu query duy nhất** thay vì 1.000 câu.

---

### 3.6. Bộ Nhớ In-Memory: `useClones: false` vs Redis
Trong file provider `memory-cache.ts`:
```ts
useClones: false // Default to false for speed, true would be slower but safer. we can ...discuss
```
- **Pass-by-Reference (Tham chiếu):** Khi `useClones: false`, NodeCache trả về thẳng **địa chỉ ô nhớ trên RAM** (Zero-copy). Tốc độ cực nhanh (0ms), không tốn CPU clone object.
- **Rủi ro:** Nếu code ở đâu đó lỡ tay sửa thuộc tính của object lấy từ cache, dữ liệu trong cache sẽ bị sửa theo. Tuy nhiên, Medusa tuân thủ nguyên tắc Immutability (chỉ đọc).
- **Với Redis (Production):** Vấn đề này không tồn tại vì dữ liệu gửi qua mạng đến Redis bắt buộc phải serialize (`JSON.stringify`) và deserialize (`JSON.parse`), nên dữ liệu luôn được clone an toàn 100%.

---

## 4. Dữ Liệu Được Tự Động Cache Mặc Định Trong Medusa Core

Khi bật Caching Module, các API cốt lõi (đặc biệt là giỏ hàng & checkout) tự động kích hoạt cache:
- **Regions & Countries**: Danh sách vùng, quốc gia, thuế suất mặc định.
- **Variant Prices & Price Sets**: Bảng giá theo currency/region của sản phẩm.
- **Variants & Products**: Thông tin sản phẩm.
- **Shipping Options**: Danh sách phương thức giao hàng và giá cước.
- **Promotion Codes**: Danh sách mã khuyến mãi và quy tắc giảm giá.
- **Sales Channels**: Danh sách kênh bán hàng.
- **Customers**: Dữ liệu khách hàng.

---

## 5. Hướng Dẫn Cấu Hình (Setup)

### Bước 1: Bật Feature Flag trong `.env`
```env
MEDUSA_FF_CACHING=true
CACHE_REDIS_URL=redis://localhost:6379
```

### Bước 2: Khai báo Module trong `medusa-config.ts`
```ts
import { defineConfig, Modules } from "@medusajs/framework/utils"

module.exports = defineConfig({
  // ...
  modules: [
    {
      resolve: "@medusajs/medusa/caching",
      options: {
        ttl: 3600, // TTL mặc định: 1 giờ (3600 giây)
        providers: [
          {
            resolve: "@medusajs/caching-redis",
            id: "caching-redis",
            is_default: true,
            options: {
              redisUrl: process.env.CACHE_REDIS_URL,
            },
          },
        ],
      },
    },
  ],
})
```

---

## 6. Hướng Dẫn Sử Dụng Trong Code

### Cách 1: Tự động qua Query Graph / Workflows (Khuyên dùng)
Không cần tự quản lý key hay tag, Medusa làm tất cả:

```ts
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"

// Trong Workflow:
const { data: products } = useQueryGraphStep({
  entity: "product",
  fields: ["id", "title", "variants.*"],
  options: {
    cache: {
      enable: true, // Tự động sinh key, tự gán tags Product:list:* và Product:{id}
      ttl: 600,     // 10 phút
    },
  },
})
```

### Cách 2: Dùng trực tiếp Service (`cachingModuleService`)
Thích hợp cho tính toán nặng hoặc cache kết quả gọi API bên thứ ba:

```ts
import { Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export const getExternalShippingRateStep = createStep(
  "get-external-shipping-rate",
  async (input: { fromZip: string; toZip: string; weight: number }, { container }) => {
    const cachingService = container.resolve(Modules.CACHING)

    // 1. Tự động hash input thành cache key
    const cacheKey = await cachingService.computeKey(input)

    // 2. Kiểm tra cache
    const cachedRate = await cachingService.get({ key: cacheKey })
    if (cachedRate) {
      return new StepResponse(cachedRate)
    }

    // 3. Gọi API bên thứ ba khi cache miss
    const rate = await callThirdPartyCarrierApi(input)

    // 4. Lưu vào cache với tag để quản lý
    await cachingService.set({
      key: cacheKey,
      data: rate,
      tags: ["Carrier:Rates"],
      ttl: 1800, // 30 phút
    })

    return new StepResponse(rate)
  }
)
```

**Chủ động xóa cache khi cần:**
```ts
const cachingService = container.resolve(Modules.CACHING)

// Xóa toàn bộ biểu phí giao hàng khi có chính sách mới:
await cachingService.clear({
  tags: ["Carrier:Rates"],
})
```
