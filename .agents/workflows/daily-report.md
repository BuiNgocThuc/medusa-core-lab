---
description: Tự Động Viết Báo Cáo Hàng Ngày Trên LarkSuite (Chuẩn Mực Kỹ Thuật, Khiêm Tốn, Đúng Trọng Tâm)
---

# /daily-report - Tự Động Viết Báo Cáo Hàng Ngày Trên LarkSuite

$ARGUMENTS

---

## 🎯 Mục Đích
Lệnh `/daily-report` tự động hoá việc thu thập thông tin làm việc trong ngày từ git commit và tài liệu dự án, dịch sang ngôn ngữ kỹ thuật chuẩn mực (Understated Rigor: đủ ý, khiêm tốn, đúng trọng tâm, triệt tiêu hoàn toàn buzzwords/khoe khoang), và đồng bộ lên LarkSuite Base sau khi được User phê duyệt.

## 🔴 CRITICAL RULES
1. **Lệnh Update:** BẮT BUỘC dùng MCP tool `bitable_v1_appTableRecord_update` từ `larksuite` server (gọi qua `call_mcp_tool`).
2. **Quy Tắc Zero-Emoji (Tuyệt Đối):** Tuân thủ quyết định kiến trúc toàn dự án — KHÔNG sử dụng bất kỳ emoji hoặc icon nào trong Description trên LarkSuite Base. Chỉ dùng dấu gạch đầu dòng tiêu chuẩn (`- `).
3. **Thứ Tự Nguồn Dữ Liệu (Local First):** Bắt buộc đọc dữ liệu local (`git log` + `memory-bank/activeContext.md`) TRƯỚC khi fetch LarkSuite để nắm rõ sự thật khách quan về kết quả công việc trong ngày, tránh bị neo tư duy bởi Description cũ trên bảng.
4. **Approval Gate (Cổng Duyệt):** BẠN (AGENT) TUYỆT ĐỐI KHÔNG ĐƯỢC GỌI TOOL UPDATE LÊN LARK KHI CHƯA TRÌNH BÀY BẢN NHÁP VÀ ĐƯỢC USER PHÊ DUYỆT RÕ RÀNG!

---

## 🛠 QUY TRÌNH THỰC THI (4 Giai Đoạn)

### Giai Đoạn 1: GATHER CONTEXT (Thu Thập Dữ Liệu)
1. **Đọc Dữ Liệu Local Trước (Ground Truth):**
   - Chạy lệnh `git log --oneline --since="24 hours ago"` (hoặc theo ngày hôm nay GMT+7) để xác định danh sách commits thực tế.
   - Đọc file `memory-bank/activeContext.md` để nắm rõ context hiện tại, các quyết định kiến trúc và các task vừa hoàn thành.
2. **Fetch Dữ Liệu LarkSuite Base:**
   - Dùng `call_mcp_tool` gọi `bitable_v1_appTableRecord_search` vào Base `QVDbbGjeEaiqPcsa4nIj2Dt5pBe` (Table `tblXMNxoCdfjmAlq`, view `vewMdBESnS`).
   - Lấy page kích thước 20-50 records gần nhất mà không dùng bộ lọc phức tạp ở query (để tránh lỗi `InvalidFilter` do field Assignee là User Object).
   - Lọc in-memory: Tìm các record của user `Công Hùng Đào` (`hungdc@smartosc.com`) có `Date` hoặc `last_modified_time` khớp với ngày hôm nay theo giờ GMT+7 (`Asia/Ho_Chi_Minh`), hoặc đang ở trạng thái `Type = "Today's tasks"`.
   - Nếu không tìm thấy task nào, báo rõ tình trạng (Empty State) và dừng lại.

### Giai Đoạn 2: SYNTHESIZE & DRAFT (Tổng Hợp & Soạn Thảo Chuẩn Mực)
1. **Triết Lý "Understated Rigor" (Nghiêm cẩn, khiêm tốn, đúng trọng tâm):**
   - Phản ánh đúng bản chất kỹ thuật, không phóng đại quy mô task.
   - Độ dài tương xứng:
     * Task triển khai code / bugfix vừa và nhỏ: **2 - 3 bullet points**.
     * Task kiến trúc / phân tích hệ thống lớn: **3 - 4 bullet points**.

2. **Phân Loại Định Dạng Theo Bản Chất Task:**
   - **Nhánh 1: Coding / Implementation Task (Tính năng, subscriber, API, test):**
     * *Bullet 1 (Action & Scope):* Tên tính năng, file path thực tế (`src/...`), module liên quan.
     * *Bullet 2 (Technical Mechanism):* Giải quyết bài toán kỹ thuật cốt lõi bằng cơ chế gì (Idempotency, Error classification skip/retry, Transaction boundary, Non-blocking I/O...).
     * *Bullet 3 (Verification):* Kết quả kiểm thử cụ thể (số lượng unit/integration test cases, các edge cases đã bao phủ, trạng thái kiểm thử local).
   - **Nhánh 2: Architecture / Research Task (Nghiên cứu, thiết kế, đọc source):**
     * *Bullet 1 (Objective & Scope):* Phạm vi và mục tiêu nghiên cứu (module, luồng nghiệp vụ, công nghệ khảo sát).
     * *Bullet 2 (Key Architectural Findings):* Những phát hiện kỹ thuật cốt lõi (schema constraints, DTO contracts, module links, failure modes).
     * *Bullet 3 (Deliverables & Documentation):* Sản phẩm bàn giao cụ thể (Tài liệu Notion, RFC, system diagrams).

3. **Bảng Anti-Patterns (CẤM TUYỆT ĐỐI):**
   - CẤM danh xưng tự phong: "chuẩn Staff Engineer", "chuẩn Senior", "chuẩn Enterprise".
   - CẤM từ ngữ cường điệu: "triệt tiêu hoàn toàn", "tuyệt hảo", "vượt trội", "bài bản nhất".
   - CẤM trích dẫn micro-benchmark dev vô nghĩa: ví dụ "26.8ms" (chỉ là latency môi trường dev, không phản ánh production).
   - CẤM tường thuật quá trình trình diễn: ví dụ "Live Demo thành công", "được đồng nghiệp tán thưởng".
   - CẤM chèn emoji hoặc icon vào text Description.

### Giai Đoạn 3: APPROVAL GATE (Dừng & Bắt Buộc Xuất Bản Nháp)
1. **Bắt Buộc Trình Bày Bản Nháp Hoàn Chỉnh (MANDATORY DRAFT BLOCK):**
   - Kể cả khi User đã thảo luận hoặc đồng ý sơ bộ một Option trước đó, Agent **BẮT BUỘC PHẢI IN RA** khối giao diện Bản Nháp hoàn chỉnh trước khi được phép gọi bất kỳ tool ghi dữ liệu nào.
   - Format khối nháp chuẩn mực:
     ```markdown
     ## 📋 BẢN NHÁP CẬP NHẬT (DRAFT FOR VERIFICATION)
     - Record ID: <id>
     - Task Title: <title>
     - Phân loại: Today's tasks | Trạng thái: Completed
     
     ### Description Đề Xuất:
     - <bullet 1>
     - <bullet 2>
     - <bullet 3>
     ```
2. **In ra câu hỏi xác nhận duy nhất:**
   `"Bạn có đồng ý update nội dung bản nháp này lên LarkSuite không? Hãy phản hồi OK hoặc yêu cầu chỉnh sửa."`
3. **DỪNG LUỒNG THỰC THI (Stop Execution):**
   - Tuyệt đối KHÔNG gọi tool update ở cùng lượt xuất bản nháp.
   - Chỉ được gọi tool update khi nhận được phản hồi "OK" hoặc xác nhận đồng ý trực tiếp cho chính bản nháp đó.

### Giai Đoạn 4: UPDATE (Đồng Bộ)
*(Chỉ thực hiện khi User đã phản hồi "OK" duyệt bản nháp ở Giai Đoạn 3)*
1. Gọi `call_mcp_tool` với `bitable_v1_appTableRecord_update` để đẩy Description lên LarkSuite cho từng `record_id`.
   - **Lưu ý Payload:** Field `Description` trên bảng LarkSuite này nhận plain-text string (có chứa các ký tự xuống dòng `\n`). Tuyệt đối KHÔNG gửi dạng array object `[{ type: "text", text: ... }]` để tránh lỗi `1254060 TextFieldConvFail`.
   - Payload chuẩn:
     ```json
     {
       "fields": {
         "Description": "- Dòng 1...\n- Dòng 2...\n- Dòng 3..."
       }
     }
     ```
2. Báo cáo kết quả đồng bộ thành công kèm link hoặc thông tin đối chiếu cho User.

---

## 💡 Ví Dụ Đối Chiếu Chuẩn (Reference Examples)

### Ví dụ 1: Task Code (Customer Welcome Subscriber)
- **BAD (Phô trương, khoe khoang, buzzword):**
  ```text
  - Hoàn tất phân tích yêu cầu và đặc tả kiến trúc 12 bước chuẩn Staff Engineer cho tính năng Customer Welcome Event Subscriber; xây dựng giải pháp kỹ thuật bài bản trước khi triển khai.
  - Thiết lập cơ chế Idempotency dựa trên định dạng key tất định kết hợp Unique Database Constraint nhằm triệt tiêu rủi ro trùng lặp thông báo.
  - Thực hiện Live Demo End-to-End thành công trên môi trường local: Xác nhận phản hồi HTTP tạo khách hàng không bị gián đoạn (Non-blocking: 26.8ms)...
  ```
- **GOOD (Chuẩn mực, đúng bản chất, khiêm tốn):**
  ```text
  - Triển khai Event Subscriber (src/subscribers/customer-created.ts) lắng nghe sự kiện customer.created, tích hợp Notification Module để gửi email chào mừng khách hàng mới.
  - Xử lý Idempotency và Error Handling: Áp dụng cơ chế kiểm tra key trùng lặp trước khi gửi; phân loại lỗi rõ ràng (skip nếu thiếu email hợp lệ, rethrow nếu lỗi hạ tầng để kích hoạt retry từ Event Bus).
  - Hoàn thiện bộ Unit Tests (src/subscribers/__tests__/customer-created.unit.spec.ts) bao phủ luồng chính và các edge cases (thiếu dữ liệu, DB exception); kiểm thử tích hợp thành công trên môi trường local.
  ```

### Ví dụ 2: Task Nghiên Cứu Kiến Trúc (Research Architecture)
- **GOOD (Đầy đủ phát hiện, không bịa test):**
  ```text
  - Nghiên cứu schema dữ liệu Customer Module trong Medusa v2: Bóc tách mô hình 5 bảng, phân tích cơ chế Soft Delete và ràng buộc UNIQUE (email, has_account) WHERE (deleted_at IS NULL).
  - Làm rõ cơ chế Module Links: Phân định Stored Link giữa Customer và Payment Module (qua bảng customer_account_holder) với Logical Link qua Auth Module (định danh bằng app_metadata).
  - Xuất bản tài liệu phân tích kỹ thuật hoàn chỉnh lên Notion phục vụ chuyển giao nội bộ.
  ```
