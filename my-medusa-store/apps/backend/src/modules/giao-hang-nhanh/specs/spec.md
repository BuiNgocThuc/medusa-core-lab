# GHN Fulfillment Provider — Kien Truc & Hop Dong Tich Hop

> **Cap nhat lan cuoi:** 2026-09-27
> **Nguyen tac thiet ke cot loi:** Tach biet ro rang giua **Medusa Configuration** va **GHN Runtime Data**.

---

## 1. Nguyen Tac Thiet Ke Cot Loi

### Medusa vs GHN — Hai lop hoan toan tach biet

```
Medusa Configuration (Admin setup, luu vao DB)
--------------------------------------------------------------
  Shipping Option: "GHN Delivery"
    - fulfillment_option.id = "ghn-delivery"  <- Khong gan service_type_id!
    - price_type = "calculated"
    - provider_id = "ghn"

           |
           |  (Checkout Runtime - KHONG luu DB)
           v

GHN Runtime Data (tinh dong moi lan checkout)
--------------------------------------------------------------
  getAvailableServices(from_district, to_district)
    -> [{ service_type_id: 2, short_name: "Hang nhe" },
        { service_type_id: 5, short_name: "Hang nang" }]
           |
           v
  resolveServiceTypeId(services, weight)
    - weight < 20kg  -> service_type_id = 2
    - weight >= 20kg -> service_type_id = 5
    - fallback       -> services[0].service_type_id
           |
           v
  calculateFee({ from_district, to_district, weight, service_type_id })
    -> total: 20900  <- Gia cuoc that tu GHN API
           |
           v
  Medusa: calculated_amount = 20900
```

### Ly do KHONG embed service_type_id vao FulfillmentOption

| Van de | Giai thich |
|---|---|
| service_type_id phu thuoc **tuyen duong** | GHN chi cho biet service nao kha dung SAU KHI biet from_district va to_district |
| service_type_id phu thuoc **can nang** | Hang nhe < 20kg dung type 2; hang nang >= 20kg dung type 5 |
| service_type_id phu thuoc **hop dong Shop** | Cung mot tuyen, Shop khac nhau co the duoc phep dung cac goi khac nhau |
| Admin khong biet truoc dia chi nguoi mua | Tai thoi diem Admin cau hinh Shipping Option, chua co to_district nao |

---

## 2. getFulfillmentOptions() — Chi la Medusa Config

```typescript
// DUNG: Tra ve 1 option dai dien o cap Medusa Config
// service_type_id KHONG nam o day
async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
  return [
    {
      id: "ghn-delivery",
      name: "GHN Delivery",
    },
  ]
}
```

Khi Admin bam Save trong Dashboard, Medusa luu `{ id: "ghn-delivery", name: "GHN Delivery" }` vao cot **data** (JSONB) cua bang `shipping_option`.

---

## 3. resolveServiceTypeId() — Trai Tim Dynamic Pricing

```typescript
private async resolveServiceTypeId(
  fromDistrictId: number,
  toDistrictId: number,
  totalWeightGrams: number
): Promise<number> {
  // Buoc 1: Hoi GHN tuyen nay ho tro goi nao
  const services = await this.client_.getAvailableServices(fromDistrictId, toDistrictId)

  if (!services || services.length === 0) {
    throw new Error("No GHN service available for route")
  }

  // Buoc 2: Chon goi dua tren can nang
  const isHeavy = totalWeightGrams >= 20_000
  const preferredTypeId = isHeavy ? 5 : 2

  const matched = services.find((s) => s.service_type_id === preferredTypeId)
  if (matched) return matched.service_type_id

  // Buoc 3: Fallback - goi dau tien kha dung
  return services[0].service_type_id
}
```

---

## 4. GHN service_type_id Reference

| service_type_id | Ten GHN | Dieu kien ap dung |
|---|---|---|
| 2 | Hang nhe (Light goods) | Tong trong luong < 20.000g |
| 5 | Hang nang (Heavy goods) | Tong trong luong >= 20.000g hoac nhieu kien |
| (khac) | Cac goi theo hop dong | Xem ket qua getAvailableServices() thuc te |

---

## 5. Shipping Option Type — Chi La Nhan Phan Loai

`Shipping Option Type` (Standard / Express) **KHONG** anh huong den:
- Gia van chuyen GHN
- Goi dich vu GHN duoc chon
- Checkout flow hay fulfillment

No chi co 2 muc dich:
1. **Phan loai / to chuc** cac shipping options tuong tu nhau
2. **Ap promotion theo nhom**: Tao type "Express" -> gom shipping options giao nhanh -> ap promotion giam phi ship cho ca nhom cung luc

---

## 6. Chien Luoc Fallback

| Tinh huong | Hanh vi |
|---|---|
| Khong co to_district_id va khong co province | Tra ve fallback **30.000d** (tam tinh) |
| Co province nhung khong co to_district_id | Dung Quan 1 (1442) lam fallback |
| GHN API khong co service nao cho tuyen do | resolveServiceTypeId throw, bao loi 35.000d |
| GHN API goi that bai | Bat loi, tra **35.000d** |