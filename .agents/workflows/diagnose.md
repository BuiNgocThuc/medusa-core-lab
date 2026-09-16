---
description: Điều tra bug chưa rõ nguyên nhân — giả thuyết + bằng chứng trước, sửa sau
argument-hint: [mô tả triệu chứng]
---

# Diagnose: $ARGUMENTS

## QUY TẮC SỐ 1

**KHÔNG sửa một dòng code nào** cho tới khi xác định được root cause có bằng chứng.

## 1. THU THẬP

Hỏi tôi nếu thiếu: triệu chứng chính xác, khi nào xảy ra, khi nào KHÔNG xảy ra, môi trường (local / docker compose / CI), log / stack trace, thay đổi gần đây.

## 2. GIẢ THUYẾT

Liệt kê 3-5 giả thuyết, xếp theo xác suất từ cao xuống thấp.
Với mỗi giả thuyết, nêu cách kiểm chứng nhanh nhất: đọc file nào, log gì, chạy lệnh gì.

## 3. KIỂM CHỨNG

Loại trừ từng giả thuyết bằng bằng chứng cụ thể trong code / log, không phải bằng suy đoán.

## 4. CHỐT

Chốt root cause kèm bằng chứng. Nếu vẫn chưa chắc, nói thẳng là chưa chắc và đề xuất bước điều tra tiếp theo. Đừng đoán bừa rồi sửa lung tung.

Chỉ sau khi tôi xác nhận root cause, mới đề xuất cách fix.

think harder
