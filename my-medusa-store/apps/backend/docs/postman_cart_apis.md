# Postman API Documentation — Cart & Merge Workflow

Tài liệu đặc tả các Request Input và Response Output cho Postman liên quan đến luồng **Merge Cart** và **Validate Checkout Email**.

---

## 0. Cấu hình Môi trường Postman (Environment Variables)

Khởi tạo các biến môi trường sau trong Postman:

| Variable | Giá trị mẫu | Ghi chú |
| :--- | :--- | :--- |
| `base_url` | `http://localhost:9000` | URL của Medusa Backend |
| `publishable_key` | `pk_01J...` | Publishable API Key lấy từ Medusa Admin |
| `customer_token` | `eyJhbGciOi...` | JWT Token nhận được sau khi login (`POST /auth/customer/emailpass`) |
| `guest_cart_id` | `cart_01M2Q...` | ID giỏ hàng của khách vãng lai (Guest Cart) |
| `cart_id` | `cart_01M2A...` | ID giỏ hàng đang thao tác |

---

## 1. API: Merge Guest Cart vào Customer Cart

* **Endpoint:** `POST {{base_url}}/store/carts/{{guest_cart_id}}/merge-customer`
* **Method:** `POST`
* **Authentication:** Bắt buộc đăng nhập Customer (`Bearer Token`)

### Headers:
```http
Content-Type: application/json
x-publishable-api-key: {{publishable_key}}
Authorization: Bearer {{customer_token}}
```

---

### Kịch bản 1.1: Gộp thành công 100% (Tất cả món đều đủ hàng)
**Request Body:**
```json
{
  "additional_data": {}
}
```

**Response: `200 OK`**
```json
{
  "cart": {
    "id": "cart_01M2CUSTOMER_CART_ID"
  },
  "skipped_items": []
}
```

---

### Kịch bản 1.2: Gộp một phần (Có món bị hết hàng / Vượt tồn kho cộng dồn)
> Giả sử Cart A có 2 Quần (kho còn đúng 2), Guest Cart B muốn thêm 1 Quần $\rightarrow$ Món Quần bị chặn và trả về trong `skipped_items`.

**Request Body:**
```json
{}
```

**Response: `200 OK`**
```json
{
  "cart": {
    "id": "cart_01M2CUSTOMER_CART_ID"
  },
  "skipped_items": [
    {
      "variant_id": "variant_01M2FHYANB35XYEAWN9FQPFBK1",
      "title": "Quần Tây Nam Slimfit",
      "variant_title": "Size L / Đen",
      "quantity": 1,
      "reason": "EXCEEDS_AVAILABLE_STOCK"
    }
  ]
}
```

---

### Kịch bản 1.3: Toàn bộ món trong Guest Cart đều hết hàng
> Không gọi `addToCartWorkflow`, giữ nguyên Cart A, báo danh sách toàn bộ các món bị skip.

**Response: `200 OK`**
```json
{
  "cart": {
    "id": "cart_01M2CUSTOMER_CART_ID"
  },
  "skipped_items": [
    {
      "variant_id": "variant_01M2FHYANB35XYEAWN9FQPFBK1",
      "title": "Vợt Cầu Lông Yonex Astrox 99 Pro",
      "variant_title": "4U/G5",
      "quantity": 2,
      "reason": "OUT_OF_STOCK"
    },
    {
      "variant_id": "variant_01M2FHYANB71ANXNYDKYAZHCSZ",
      "title": "Quả Cầu Lông Victor Lark 5",
      "variant_title": "Tốc độ 77",
      "quantity": 5,
      "reason": "OUT_OF_STOCK"
    }
  ]
}
```

---

### Kịch bản 1.4: Customer chưa có giỏ nào trước đó (Transfer Cart)
> Khách mới tinh chưa từng có giỏ hàng, Guest Cart được chuyển quyền sở hữu sang Customer.

**Response: `200 OK`**
```json
{
  "cart": {
    "id": "cart_01M2GUEST_CART_ID"
  },
  "skipped_items": []
}
```

---

### Kịch bản 1.5: Lỗi Chưa Đăng Nhập (Unauthorized)
**Response: `401 Unauthorized`**
```json
{
  "message": "Unauthorized"
}
```

---

## 2. API: Cập nhật Địa chỉ / Email Checkout (`updateCartWorkflow`)

* **Endpoint:** `POST {{base_url}}/store/carts/{{cart_id}}`
* **Method:** `POST`

### Headers:
```http
Content-Type: application/json
x-publishable-api-key: {{publishable_key}}
```

---

### Kịch bản 2.1: Guest Checkout với Email Vãng lai Mới (Hợp lệ)
> Email chưa từng đăng ký tài khoản $\rightarrow$ Cho phép lưu bình thường.

**Request Body:**
```json
{
  "email": "khach_vang_lai_moi_123@gmail.com",
  "shipping_address": {
    "first_name": "Nguyen",
    "last_name": "Van A",
    "address_1": "123 Le Loi, Quan 1",
    "city": "Ho Chi Minh",
    "country_code": "vn",
    "postal_code": "700000",
    "phone": "0901234567"
  }
}
```

**Response: `200 OK`**
```json
{
  "cart": {
    "id": "cart_01M2Q...",
    "email": "khach_vang_lai_moi_123@gmail.com",
    "customer_id": "cus_01M2_GUEST_CUSTOMER_ID",
    "shipping_address": {
      "first_name": "Nguyen",
      "last_name": "Van A",
      "address_1": "123 Le Loi, Quan 1",
      "city": "Ho Chi Minh",
      "country_code": "vn"
    }
  }
}
```

---

### Kịch bản 2.2: Guest Checkout nhập Email ĐÃ CÓ TÀI KHOẢN (Bị Hook chặn)
> Giỏ hàng chưa đăng nhập (`customer_id = null`), nhưng cố tình nhập email của một tài khoản đã có sẵn (`has_account: true`).

**Request Body:**
```json
{
  "email": "conghung@gmail.com",
  "shipping_address": {
    "first_name": "Hung",
    "last_name": "Tran",
    "address_1": "456 Nguyen Trai",
    "country_code": "vn"
  }
}
```

**Response: `400 Bad Request`**
```json
{
  "type": "not_allowed",
  "code": "EMAIL_ALREADY_REGISTERED",
  "message": "Email này đã được đăng ký tài khoản."
}
```

---

### Kịch bản 2.3: Đã Đăng Nhập nhưng cố tình nhập Email tài khoản khác (Bị Hook chặn)
> User đang đăng nhập với tài khoản `cus_01A`, nhưng trong form checkout lại truyền email của `cus_01B`.

**Headers:**
```http
Authorization: Bearer {{customer_token}}
```

**Request Body:**
```json
{
  "email": "tai_khoan_khac@gmail.com"
}
```

**Response: `400 Bad Request`**
```json
{
  "type": "not_allowed",
  "code": "EMAIL_TAKEN_BY_ANOTHER_CUSTOMER",
  "message": "Email này thuộc về một tài khoản khác."
}
```

---

## 3. Mã cURL mẫu để Import nhanh vào Postman

### cURL: Merge Cart
```bash
curl --location --request POST 'http://localhost:9000/store/carts/cart_01M2QEEH4TBPZHFR4WPWZ0GDWC/merge-customer' \
--header 'Content-Type: application/json' \
--header 'x-publishable-api-key: pk_YOUR_KEY' \
--header 'Authorization: Bearer YOUR_CUSTOMER_JWT_TOKEN' \
--data-raw '{}'
```

### cURL: Update Cart Email & Address (Checkout)
```bash
curl --location --request POST 'http://localhost:9000/store/carts/cart_01M2QEEH4TBPZHFR4WPWZ0GDWC' \
--header 'Content-Type: application/json' \
--header 'x-publishable-api-key: pk_YOUR_KEY' \
--data-raw '{
  "email": "user@example.com",
  "shipping_address": {
    "first_name": "Thuc",
    "last_name": "Bui",
    "address_1": "123 Nguyen Thi Minh Khai",
    "country_code": "vn",
    "city": "HCM",
    "phone": "0987654321"
  }
}'
```

---

## 4. API Core: Xem Tồn Kho của 1 Variant (Storefront API)

Medusa v2 hỗ trợ sẵn API Storefront để lấy số lượng tồn kho (`inventory_quantity`) của variant theo từng Sales Channel mà **không cần viết thêm code**.

* **Endpoint:** `GET {{base_url}}/store/product-variants/{{variant_id}}?fields=+inventory_quantity,product.*`
* **Method:** `GET`
* **Headers:**
  ```http
  x-publishable-api-key: {{pk_channel_a}}
  ```

### Response mẫu: `200 OK`
```json
{
  "variant": {
    "id": "variant_01J8ABC...",
    "title": "Default",
    "sku": "TSHIRT-M",
    "manage_inventory": true,
    "allow_backorder": false,
    "inventory_quantity": 8,
    "product": {
      "id": "prod_01J8ABC...",
      "title": "Medusa T-Shirt",
      "handle": "medusa-t-shirt",
      "thumbnail": "..."
    }
  }
}
```

> **Lưu ý:**
> - `product.*`: Bắt buộc phải có dấu chấm `.` (`product.*`) để engine expand relation `product`. Không dùng `*product`.
> - `inventory_quantity` được Medusa tự động tính toán dựa trên các kho hàng (`stock_locations`) được liên kết với Sales Channel của `publishable_key` tương ứng.
> - Nếu đổi sang `{{pk_channel_b}}`, trường `inventory_quantity` sẽ phản ánh số tồn kho của Channel B.

### cURL mẫu:
```bash
curl --location 'http://localhost:9000/store/product-variants/variant_01J8ABC...?fields=+inventory_quantity,product.*' \
--header 'x-publishable-api-key: pk_YOUR_KEY'
```
