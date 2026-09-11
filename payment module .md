# **Payment Documentation – Project MedusaJS** 

#### **Phiên bản: 1.0** 

Cập nhật: September 2026 

## **1. Tổng quan (Overview)** 

#### **1.1. Mục đích** 

Module Payment trong project chịu trách nhiệm: 

- Quản lý toàn bộ vòng đời thanh toán của Cart / Order. 

- Hỗ trợ nhiều phương thức thanh toán, đặc biệt các cổng phổ biến tại Việt Nam. 

- Cho phép Authorize → Capture → Refund. 

- Xử lý webhook từ các cổng thanh toán bên thứ ba. 

- Cung cấp dữ liệu để thống kê và báo cáo. 

Medusa cung cấp sẵn **Payment Module** (Commerce Module) với các tính năng chính: 

|**Tính năng**|**Mô tả**|**Link docs**|
|---|---|---|
|Authorize, Capture,<br>Refund|Xử lý thanh toán cho một resource|Payment|
|Payment Collection|Quản lý nhiều payment session/payment cho một<br>cart/order|Payment Collection|
|Third-party Providers|Tích hợp Stripe hoặc Custom Provider|Payment Provider|
|Saved Payment<br>Methods|Lưu phương thức thanh toán của customer|Account Holder|
|Webhook Events|Xử lý sự kiện từ cổng thanh toán|Webhook Events|



#### **1.2. Các khái niệm cốt lõi (theo Medusa)** 

|**Khái niệm**|**Giải thích ngắn**|**Data Model**|
|---|---|---|



|**Payment Collection**|Container chứa tất cả thông tin thanh toán của<br>một resource (thường là Cart). Một cart chỉ có 1<br>Payment Collection.|PaymentCollection|
|---|---|---|
|**Payment Session**|Một phiên thanh toán với một provider cụ thể.<br>Chứa amount, currency_code, status, data.|PaymentSession|
|**Payment**|Được tạo khi Payment Session được**authorize**<br>thành công. Có thể capture và refund.|Payment|
|**Capture**|Bản ghi khi tiền được capture. Hỗ trợ capture<br>từng phần (incremental).|Capture|
|**Refund**|Bản ghi khi hoàn tiền. Hỗ trợ refund nhiều lần.|Refund|
|**Payment Provider**|Service xử lý thực tế với cổng thứ 3 (VNPay,<br>MoMo…).|PaymentProvider|



##### **Lưu ý:** 

Payment Module **không** tự xử lý logic với cổng thanh toán. Nó chỉ quản lý data model và gọi các method của Payment Provider. 

Tất cả logic gọi API VNPay / MoMo / ZaloPay… phải nằm trong **Custom Payment Provider** . 

#### **1.3. Default Provider** 

Medusa có sẵn provider pp_system (system provider). 

Nó **không** thực hiện thanh toán thật, chỉ dùng như COD / Manual Payment. 

#### **2. Các phương thức thanh toán hỗ trợ (Supported Payment Methods)** 

Nhóm theo loại, tập trung thị trường Việt Nam: 

|**Nhóm**|**Phương**<br>**thức**|**Provider ID đề xuất**|**Loại**|**Ghi chú**|
|---|---|---|---|---|
|Ví điện tử|MoMo|pp_momo_momo|Async / Redirect|Rất phổ biến|
|Ví điện tử|ZaloPay|pp_zalopay_zalopay|Async / Redirect|Tích hợp tốt<br>với Zalo|
|Cổng tổng<br>hợp|VNPay|pp_vnpay_vnpay|QR + Bank + Card|Hỗ trợ<br>VietQR,<br>NAPAS, thẻ<br>nội địa &<br>quốc tế|
|Chuyển<br>khoản /<br>QR|VietQR /<br>NAPAS 247|Thường qua VNPay<br>hoặc PayOS|Async|Real-time<br>hoặc delayed|
|Thẻ|Visa /<br>Mastercard /<br>JCB / ATM|VNPay / OnePay|Sync hoặc 3DS||
|Manual|COD /<br>Chuyển<br>khoản thủ<br>công|pp_system|Manual|Dùng system<br>provider|



#### **2.2. Đặc thù của các cổng Việt Nam so với Stripe** 

|**Đặc điểm**|**Stripe**|**Cổng VN (VNPay, MoMo…)**|
|---|---|---|
|Authorization|Thường sync|Thường**async**(pending_authorization)|
|Capture|Có thể auto hoặc<br>manual|Nhiều cổng capture ngay khi thanh toán<br>thành công|
|Webhook|Bắt buộc|**Bắt buộc**(rất quan trọng)|
|Trả về data|Payment Intent ID|transactionId, orderId, qrCode, payUrl…|
|Status đặc biệt|requires_action|pending_authorization (từ Medusa v2.17.2)|



##### ● **Quan trọng:** 

Từ Medusa **v2.17.2** , khi provider trả về status pending_authorization, Medusa sẽ: 

- Không tạo Payment ngay. 

- Cập nhật PaymentSession.status = "pending_authorization". 

- → 

- Vẫn cho phép complete cart tạo Order với trạng thái payment “awaiting”. 

- Sau đó dùng webhook để authorize lại. 

Đây là cơ chế phù hợp nhất với VietQR, chuyển khoản ngân hàng, MoMo/ZaloPay redirect. 

● 

#### **3. Kiến trúc & Flow chi tiết** 

|**Lớp**|**Trách nhiệm**|**Ai quản lý**|
|---|---|---|
|**Payment**<br>**Module**|Quản lý data model (PaymentCollection,<br>PaymentSession, Payment, Capture, Refund), trạng<br>thái, quan hệ với Cart/Order|Core Medusa|
|**Payment**|Gọi API thực tế tới cổng thanh toán (VNPay, MoMo,|Custom code|
|**Module**<br>**Provider**|ZaloPay…), trả về data và status|của project|



-Payment Module Provider **chỉ** xử lý logic với third-party. Nó **không** quản lý Payment Session hay Payment Collection. Payment Module sẽ gọi các method của Provider và tự cập nhật database. 

#### **3.3. Payment Session Status** 

Theo docs chính thức: 

|**Status**|**Ý nghĩa**|**Khi nào xảy ra**|**Hành động tiếp theo**|
|---|---|---|---|
|pending|Đang chờ authorize|Ngay sau khi tạo<br>session|Gọi authorizePayment|
|requires_more|Cần thêm hành động<br>từ user (3DS, OTP,<br>confirm…)|Provider trả về<br>yêu cầu thêm<br>bước|Frontend xử lý<br>gọi lại<br>→<br>authorize|
|authorized|Đã authorize thành<br>công|Provider xác<br>nhận|Tạo Payment, có thể<br>Capture|
|pending_authorizatio<br>n|Chờ xác nhận bất đồng<br>bộ|VietQR, Bank<br>Transfer, một số<br>ví điện tử|Đợi webhook hoặc admin<br>re-check|
|error|Lỗi khi authorize|Provider trả lỗi|Có thể thử lại hoặc hủy|
|canceled|Đã hủy authorization|Gọi cancel|Không thể authorize lại|



**Lưu ý quan trọng về pending_authorization** (có từ Medusa **v2.17.2** ): 

- Khi provider trả về status này → authorizePaymentSession **trả về null** (không tạo Payment). 

- Cart vẫn có thể được complete → Order được tạo với payment status = awaiting. 

- Khi webhook đến và xác nhận → Medusa tự authorize lại và cập nhật Order. 

- Cách Medusa Payment Module hoạt động (Payment Collection, Session, Payment, Capture, Refund). 

- Sequence diagram cho các flow chính: 

   - Checkout → Initiate Payment Session 

   - Redirect / QR / App-to-App 

   - Webhook xử lý kết quả 

   - Capture & Refund 

   - Failed / Timeout / Cancel 

### **3.4. Payment Flow chi tiết (Checkout)** <u>Payment Flow docs:</u> 

##### **Bước 1: Tạo Payment Collection** 

- Thường được tạo tự động khi bắt đầu checkout hoặc khi gọi workflow. 

- Gắn với Cart thông qua link module. 

##### **Bước 2: Lấy danh sách Payment Providers** 

- Chỉ lấy những provider **đã được enable** trong Region của Cart. 

- Dùng Query của Medusa để lấy (không query trực tiếp database). 

##### **Bước 3: Tạo Payment Session** 

Khi customer chọn một phương thức thanh toán: 

1. Medusa gọi createPaymentSessionsWorkflow (hoặc service tương ứng). 

2. Medusa kiểm tra provider có được enable trong region không. 

3. Gọi method initiatePayment() của Provider. 

4. Provider trả về data (ví dụ: payUrl, qrCode, transactionId…). 

5. Medusa lưu data vào PaymentSession.data. 

**Lưu ý:** data này sẽ được trả về storefront → chỉ lưu những gì **public** được. 

##### **Bước 4: Authorize Payment Session** 

Khi customer bấm “Đặt hàng”: 

1. Gọi authorizePaymentSession. 

2. Medusa gọi authorizePayment() của Provider. 

3. Có 3 trường hợp chính: 

|**Kết quả từ Provider**|**Hành vi của Medusa**|
|---|---|
|authorized|Tạo Payment, session<br>authorized<br>→|
|pending_authorization|Không tạo Payment, session<br>pending_authorization, vẫn<br>→<br>cho complete cart|
|requires_more|Cập nhật status, ném lỗi<br>frontend xử lý thêm bước rồi gọi<br>→<br>lại|



##### **Bước 5: Complete Cart & Capture** 

- Sau khi authorize thành công (hoặc pending_authorization), gọi completeCartWorkflow. 

- Capture có thể: 

   - Tự động (nếu provider hỗ trợ auto-capture). 

   - Thủ công từ Admin hoặc qua workflow capturePaymentWorkflow. 

#### **3.5. Webhook Flow (cực kỳ quan trọng với cổng VN)** 

Medusa cung cấp sẵn endpoint: POST /hooks/payment/{identifier}_{provider} 

Ví dụ: 

- VNPay → /hooks/payment/vnpay_vnpay 

- MoMo → /hooks/payment/momo_momo 

- ZaloPay → /hooks/payment/zalopay_zalopay 

##### **Cách tạo URL:** 

- identifier = giá trị static identifier trong class Provider. 

- provider = id bạn khai báo trong medusa-config.ts. 

##### **Ví dụ:** 

|**Provider**|**static identifier**|**id trong config**|**Webhook URL**|
|---|---|---|---|
|VNPay|vnpay|vnpay|/hooks/payment/vnpay_vnpay|
|MoMo|momo|momo|/hooks/payment/momo_momo|
|ZaloPay|zalopay|zalopay|/hooks/payment/zalopay_zalopay|



##### **Flow xử lý webhook của Medusa:** 

1. Cổng gửi POST đến /hooks/payment/... 

2. Medusa gọi getWebhookActionAndData() của Provider tương ứng. 

3. Provider phải: 

   - Verify chữ ký (signature / checksum). 

   - Parse dữ liệu. 

   - Trả về WebhookActionResult. 

4. Nếu action = authorized hoặc captured: 

   - Medusa cập nhật Payment Session / Payment. 

   - Nếu Cart chưa complete → Medusa **tự động complete cart** (qua processPaymentWorkflow). 



<!-- Start of picture text -->
modules: [<br>{<br>resolve: "“@medusajs/medusa/payment",<br>options: {<br>webhook_delay: 5000,<br>webhook_retries: 3,<br>providers: [ ...]<br>4i<br><!-- End of picture text -->



<!-- Start of picture text -->
. Execute Return event<br>Receivevewwebhook v event =——-——————___»> getWebhookActionAndDataA a action<br>Capture associated Yes . . . No . . . .<br>payment session . —_—X<—§_—OS9S" action= ‘captured’? ——  +——- ___ action= ‘authorized?<br>t Ne I"<br>Authorize associated<br>No i<br>Complete cart <———_____- Is cart completed? payment session<br>| Yes<br>End<br><!-- End of picture text -->

|webhook_retries|Số lần retry khi xử lý webhook lỗi|Không<br>3|
|---|---|---|
|providers|Mảng các Payment Provider cần đăng<br>ký|Không<br>-|



##### **Ví dụ cấu hình (có cả Stripe + Custom VN):** 

TypeScript 

|// medusa-config.ts<br>import { defineConfig, Modules } from "@medusajs/framework/utils"<br>export default defineConfig({<br>// ...<br>modules: [<br>{<br>resolve: "@medusajs/medusa/payment",<br>options: {|
|---|
|webhook_delay: 5000,<br>webhook_retries: 3,<br>providers: [|
|// Stripe (nếu dùng)<br>{|
|<br>resolve: "@medusajs/medusa/payment-stripe",<br>id: "stripe",<br>options: {|
|<br>apiKey: process.env.STRIPE_API_KEY,|
|webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,<br>},<br>},|
|// Custom VNPay<br>{|
|<br>resolve: "./src/modules/vnpay", // hoặc path package<br>id: "vnpay",|





<!-- Start of picture text -->
            options: {<br>              tmnCode: process.env.VNPAY_TMN_CODE,<br>              hashSecret: process.env.VNPAY_HASH_SECRET,<br>              url: process.env.VNPAY_URL, // sandbox hoặc production<br>              returnUrl: process.env.VNPAY_RETURN_URL,<br>            },<br>          },<br>          // Custom MoMo<br>          {<br>            resolve: "./src/modules/momo",<br>            id: "momo",<br>            options: {<br>              partnerCode: process.env.MOMO_PARTNER_CODE,<br>              accessKey: process.env.MOMO_ACCESS_KEY,<br>              secretKey: process.env.MOMO_SECRET_KEY,<br>              // ...<br>            },<br>          },<br>        ],<br>      },<br>    },<br>  ],<br>})<br><!-- End of picture text -->

##### **Quy tắc ID Provider:** 

- Format cuối cùng của provider ID trong hệ thống: pp_{identifier}_{id} 

- Ví dụ: static identifier = "vnpay" + id: "vnpay" → Provider ID = pp_vnpay_vnpay 

- Webhook URL tương ứng: /hooks/payment/vnpay_vnpay 

#### **4.2. Cấu trúc thư mục Custom Provider** 

<mark>src/modules/ └── vnpay/                          # hoặc momo, zalopay... ├── index.ts                    # Module definition ├── service.ts                  # Main service (extends AbstractPaymentProvider) └── types.ts                    # (optional) types riêng</mark> 

#### **4.3. Tạo Service Provider (bắt buộc)** 

Service **phải** extend AbstractPaymentProvider và có static identifier. 

##### TypeScript 



<!-- Start of picture text -->
// src/modules/vnpay/service.ts<br>import  { AbstractPaymentProvider  } from "@medusajs/framework/utils"<br>import  { Logger  } from "@medusajs/framework/types"<br>import type  {<br>  InitiatePaymentInput ,<br>  InitiatePaymentOutput ,<br>  AuthorizePaymentInput ,<br>  AuthorizePaymentOutput ,<br>  CapturePaymentInput ,<br>  CapturePaymentOutput ,<br>  RefundPaymentInput ,<br>  RefundPaymentOutput ,<br>  // ... các type khác<br>} from "@medusajs/framework/types"<br>type Options  = {<br>  tmnCode: string<br>  hashSecret: string<br>  url: string<br>  returnUrl: string<br>}<br>type InjectedDependencies  = {<br>  logger: Logger<br>}<br>class VNPayPaymentProviderService extends AbstractPaymentProvider<Options> {<br>  static identifier = "vnpay"           // ← rất quan trọng<br>  protected logger_: Logger<br>  protected options_: Options<br>  constructor(container: InjectedDependencies , options: Options ) {<br>    super(container , options )<br>    this.logger_ = container.logger<br>    this.options_ = options<br>    // Khởi tạo client gọi API VNPay ở đây nếu cần<br>  }<br><!-- End of picture text -->

<mark>// === Các method bắt buộc / quan trọng ===</mark> 

} 

#### **4.4. Các method chính cần implement** 

Dựa trên interface chính thức (IPaymentProvider): 

|**Method**|**Bắt**<br>**buộc?**|**Mục đích**|**Ghi chú cho cổng VN**|
|---|---|---|---|
|initiatePayment|Có|Tạo session với<br>cổng (tạo QR,<br>payUrl…)|Trả về data chứa payUrl,<br>qrCode, orderId…|
|authorizePayment|Có|Authorize (hoặc<br>kiểm tra trạng<br>thái)|Với async thường trả<br>pending_authorization|
|capturePayment|Có|Capture tiền|Nhiều cổng VN đã capture<br>sẵn → có thể return data hiện<br>tại|
|refundPayment|Có|Hoàn tiền|Gọi API refund của cổng|
|getWebhookActionAndDat<br>a|Rất<br>quan<br>trọng|Xử lý webhook|Verify signature + trả về action|
|cancelPayment|Nên có|Hủy thanh toán||
|getPaymentStatus|Nên có|Lấy trạng thái<br>hiện tại||
|updatePayment /<br>deletePayment|Tùy|Cập nhật / xóa<br>session||
|validateOptions|Nên có<br>(static)|Validate options<br>khi start app||



##### **4.4.1. initiatePayment (quan trọng nhất lúc checkout)** 

TypeScript 

<mark>async initiatePayment</mark> ( <mark>input</mark> : <mark>InitiatePaymentInput</mark> ): <mark>Promise<InitiatePaymentOutput</mark> > { <mark>const { amount</mark> , <mark>currency_code</mark> , <mark>data</mark> , <mark>context } = input</mark> 

<mark>// 1. Tạo request tới VNPay / MoMo / ZaloPay</mark> 

<mark>// 2. Nhận lại payUrl hoặc qrCode</mark> 

<mark>return {</mark> 

<mark>id: "vnpay_txn_xxx",               // ID phía cổng status: "pending",                 // hoặc "pending_authorization" data: { payUrl: "https://..."</mark> , <mark>qrCode: "..."</mark> , <mark>orderId: "..."</mark> , <mark>amount</mark> , <mark>currency_code</mark> , <mark>// chỉ lưu data public (sẽ trả về storefront) },</mark> } } 

##### **4.4.2. authorizePayment** 

TypeScript 

<mark>async authorizePayment</mark> ( <mark>input</mark> : <mark>AuthorizePaymentInput</mark> ): <mark>Promise<AuthorizePaymentOutput</mark> > { <mark>// Với cổng async (VietQR, MoMo redirect...): return {</mark> 

<mark>status: "pending_authorization"</mark> , <mark>// ← quan trọng từ v2.17.2 data: input.data</mark> , } 

<mark>// Với cổng sync thành công: // return { status: "authorized", data: {...} }</mark> } 

##### **4.4.3. getWebhookActionAndData (cực kỳ quan trọng)** 

##### TypeScript 

<mark>async getWebhookActionAndData(payload</mark> : <mark>any</mark> ): <mark>Promise<WebhookActionResult</mark> > { <mark>// 1. Verify signature của VNPay/MoMo // 2. Parse dữ liệu</mark> 

<mark>// 3. Tìm session_id / orderId tương ứng</mark> 

<mark>return {</mark> 

<mark>action: "authorized",              // hoặc "captured" | "failed" | "not_supported" data: { session_id: "payses_...",        // bắt buộc để Medusa biết session nào amount: 100000</mark> , <mark>},</mark> } } 

#### **4.5. Đăng ký Module Provider (index.ts)** 

TypeScript 

<mark>// src/modules/vnpay/index.ts import</mark> { <mark>ModuleProvider</mark> , <mark>Modules</mark> } <mark>from "@medusajs/framework/utils" import VNPayPaymentProviderService from "./service"</mark> 

<mark>export default ModuleProvider(Modules.PAYMENT</mark> , { <mark>services: [VNPayPaymentProviderService</mark> ], }) 

#### **4.6. Enable Provider trong Region** 

Sau khi config xong: 

1. Restart Medusa. 

2. Vào **Medusa Admin → Settings → Regions** . 

3. Edit Region → bật các provider vừa tạo (pp_vnpay_vnpay, pp_momo_momo…). 

#### **4.7. Webhook URL cần cấu hình ở cổng thanh toán** 

text 

<mark>https://your-domain.com/hooks/payment/vnpay_vnpay https://your-domain.com/hooks/payment/momo_momo https://your-domain.com/hooks/payment/zalopay_zalopay</mark> 

##### **Tóm tắt checklist khi làm Custom Provider cho cổng VN:** 

1. Extend AbstractPaymentProvider + static identifier 

2. Implement initiatePayment (trả payUrl/qrCode) 

3. Implement authorizePayment (ưu tiên pending_authorization) 

4. Implement getWebhookActionAndData (verify + trả action) 

5. Implement capturePayment + refundPayment 

6. Đăng ký trong medusa-config.ts 

7. Enable trong Region 

8. Cấu hình webhook URL ở phía cổng 

## **cấu hình VNpay** 

Dưới đây là **quy trình tối thiểu** để chạy được VNPay (có thể áp dụng tương tự cho MoMo). 

#### **Bước 1: Chuẩn bị tài khoản & thông tin từ VNPay** 

Bạn cần: 

- vnp_TmnCode (Terminal Code / Merchant Code) 

- vnp_HashSecret (Secure Secret) 

- URL Sandbox: https://sandbox.vnpayment.vn 

- URL Production: https://vnpayment.vn 

- IPN URL (webhook) và Return URL 

#### **Bước 2: Tạo Custom Payment Provider** 

##### **Cấu trúc thư mục:** 

##### text 

<mark>src/modules/vnpay/ ├── index.ts └── service.ts</mark> 

##### **service.ts (phiên bản tối thiểu):** 

##### TypeScript 

|import<br>{<br>AbstractPaymentProvider<br>,<br>MedusaError<br>}<br>from<br>"@medusajs/framework/utils"|
|---|
|import<br>{<br>Logger<br>}<br>from<br>"@medusajs/framework/types"|
|import type<br>{|
|InitiatePaymentInput<br>,|
|InitiatePaymentOutput<br>,|
|AuthorizePaymentInput<br>,|
|AuthorizePaymentOutput<br>,|
|CapturePaymentInput<br>,|
|CapturePaymentOutput<br>,|
|<br>RefundPaymentInput<br>,|
|RefundPaymentOutput<br>,|
|ProviderWebhookPayload<br>,|
|WebhookActionResult<br>,|
|}<br>from<br>"@medusajs/framework/types"|
|type<br>Options<br>=<br>{|
|tmnCode<br>:<br>string|
|hashSecret<br>:<br>string|
|url<br>:<br>string<br>// sandbox hoặc production|
|returnUrl<br>:<br>string<br>}|
|class<br>VNPayProviderService<br>extends<br>AbstractPaymentProvider<br><<br>Options<br>> {<br>static<br>identifier<br> =<br>"vnpay"|
|protected<br>logger_<br>:<br>Logger|
|protected<br>options_<br>:<br>Options|
|constructor<br>(<br>container<br>:<br>any<br>,<br>options<br>:<br>Options<br>) {|
|super<br>(<br>container<br>,<br>options<br>)|
|this<br>.<br>logger_<br> =<br>container<br>.<br>logger|
|this<br>.<br>options_<br> =<br>options|
|}|
|static<br>validateOptions<br>(<br>options<br>:<br>Record<br><<br>string<br>,<br>any<br>>) {<br>if<br>(<br>!<br>options<br>.<br>tmnCode<br>|| !<br>options<br>.<br>hashSecret<br>) {|
|<br><br> <br><br> <br>throw<br>new<br>MedusaError<br>(|
|MedusaError<br>.<br>Types<br>.<br>INVALID_DATA<br>,|
|"VNPay tmnCode and hashSecret are required"<br>)<br>}<br>}|





<!-- Start of picture text -->
  async initiatePayment(input: InitiatePaymentInput ) : Promise<InitiatePaymentOutput> {<br>    const  { amount , currency_code , data  }  = input<br>    const orderId = data ? .session_id  | | `ORD_ $ {Date.now ()}`<br>    // TODO: Build payment URL theo tài liệu VNPay<br>    // Sử dụng thư viện vnpay hoặc tự implement<br>    const payUrl = `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?...`<br>    return  {<br>      id: orderId ,<br>      status: "pending" ,<br>      data:  {<br>        payUrl ,<br>        orderId ,<br>        amount ,<br>        currency_code ,<br>        session_id: data ? .session_id ,<br>      },<br>    }<br>  }<br>  async authorizePayment(input: AuthorizePaymentInput ) : Promise<AuthorizePaymentOutput> {<br>    // Với VNPay hầu hết là async → trả pending_authorization<br>    return  {<br>      status: "pending_authorization" ,<br>      data: input.data ,<br>    }<br>  }<br>  async capturePayment(input: CapturePaymentInput ) : Promise<CapturePaymentOutput> {<br>    // Nhiều trường hợp VNPay đã capture sẵn<br>    return  { data: input.data  }<br>  }<br>  async refundPayment(input: RefundPaymentInput ) : Promise<RefundPaymentOutput> {<br>    // TODO: Gọi API refund của VNPay<br>    return  { data: input.data  }<br>  }<br>  async getWebhookActionAndData (<br>    payload: ProviderWebhookPayload["payload" ]<br>  ) : Promise<WebhookActionResult> {<br>    const body = payload.data // hoặc payload.rawData tùy version<br>    // 1. Verify checksum theo tài liệu VNPay<br>    // const isValid = verifyVNPayChecksum(body, this.options_.hashSecret)<br>    // if (!isValid) throw new Error("Invalid signature")<br>    // 2. Kiểm tra kết quả<br>    const responseCode = body.vnp_ResponseCode // "00" = thành công<br><!-- End of picture text -->

<mark>if (responseCode === "00"</mark> ) { <mark>return</mark> { <mark>action: "authorized"</mark> , <mark>// hoặc "captured" nếu muốn data:</mark> { <mark>session_id: body.vnp_TxnRef</mark> , <mark>// hoặc giá trị bạn đã lưu amount: Number(body.vnp_Amount</mark> ) <mark>/ 100</mark> , <mark>// VNPay nhân 100 }, } } return</mark> { <mark>action: "failed"</mark> , <mark>data:</mark> { <mark>session_id: body.vnp_TxnRef</mark> , <mark>}, }</mark> } 

<mark>// Các method còn lại có thể return tạm async cancelPayment() { return</mark> { <mark>data: {} } } async getPaymentStatus() { return</mark> { <mark>status: "pending" } } // ...</mark> } 

<mark>export default VNPayProviderService</mark> 

##### **index.ts:** 

##### TypeScript 

<mark>import</mark> { <mark>ModuleProvider</mark> , <mark>Modules</mark> } <mark>from "@medusajs/framework/utils" import VNPayProviderService from "./service"</mark> 

<mark>export default ModuleProvider(Modules.PAYMENT</mark> , { <mark>services: [VNPayProviderService</mark> ], }) 

#### **Bước 3: Đăng ký trong medusa-config.ts** 

TypeScript 

{ <mark>resolve: "@medusajs/medusa/payment"</mark> , <mark>options: { providers: [ { resolve: "./src/modules/vnpay"</mark> , <mark>id: "vnpay"</mark> , <mark>options:</mark> { <mark>tmnCode: process.env.VNPAY_TMN_CODE</mark> , <mark>hashSecret: process.env.VNPAY_HASH_SECRET</mark> , <mark>url: process.env.VNPAY_URL</mark> | <mark>| "https://sandbox.vnpayment.vn"</mark> , <mark>returnUrl: process.env.VNPAY_RETURN_URL</mark> , <mark>},</mark> 

<mark>}, ], },</mark> } 

#### **Bước 4: Enable Provider trong Region** 

1. Vào Medusa Admin → **Settings → Regions** 

2. Edit Region (ví dụ Vietnam) 

3. Bật provider pp_vnpay_vnpay 

#### **Bước 5: Cấu hình Webhook / IPN ở phía VNPay** 

- Đăng nhập Merchant Admin của VNPay. 

- Cấu hình **IPN URL** = https://your-domain.com/hooks/payment/vnpay_vnpay 

- Return URL = trang kết quả phía frontend của bạn. 

#### **Bước 6: Flow tối thiểu khi chạy** 

1. Customer chọn VNPay → initiatePayment → trả payUrl. 

2. Frontend redirect customer sang payUrl. 

3. Customer thanh toán xong. 

4. VNPay gửi IPN về /hooks/payment/vnpay_vnpay. 

5. getWebhookActionAndData chạy → trả authorized. 

6. Medusa cập nhật session + complete cart (nếu chưa). 

#### **Checklist tối thiểu để “sống” được 1 cổng VN** 

- Tạo Provider + static identifier 

- Implement initiatePayment (trả payUrl/QR) 

- Implement authorizePayment → trả pending_authorization 

- Implement getWebhookActionAndData (verify + trả action + session_id) 

- Đăng ký trong medusa-config.ts 

- Enable trong Region 

- Cấu hình IPN URL đúng trên cổng 

- Test sandbox end-to-end 

