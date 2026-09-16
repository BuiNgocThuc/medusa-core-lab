---
description: Refactor an toàn — giữ nguyên behavior 100%
argument-hint: [file, class hoặc module cần refactor]
---

# Refactor: $ARGUMENTS

## NGUYÊN TẮC BẤT DI BẤT DỊCH

Đây là **refactor**, không phải rewrite. Behavior quan sát được từ bên ngoài phải giữ nguyên 100%.

## 1. TRƯỚC KHI LÀM

- Đọc code hiện tại và mô tả nó đang làm gì.
- Xác nhận đã có test bao phủ. Nếu chưa có, viết test cho behavior hiện tại TRƯỚC, chạy `mvn test -pl <module> -am` cho xanh, rồi mới refactor.
- Liệt kê các bước refactor theo thứ tự, mỗi bước là một thay đổi nhỏ độc lập.

## 2. CONSTRAINTS

- Không đổi public API, không đổi signature của method public, không đổi DTO contract giữa các service.
- Không gộp thêm feature mới vào lần refactor này.
- Sau **mỗi bước**, chạy `mvn test -pl <module> -am` — phải vẫn xanh trước khi làm bước tiếp theo.
- Không đụng tới file ngoài phạm vi: $ARGUMENTS

## 3. SUCCESS CRITERIA

- [ ] `mvn clean verify -B -DskipTests=false` xanh, và KHÔNG sửa test để nó pass
- [ ] Không có thay đổi hành vi quan sát được từ bên ngoài (response, HTTP status, message publish, DB state)
- [ ] Code dễ đọc hơn rõ rệt — nói rõ cải thiện ở điểm nào

think harder
