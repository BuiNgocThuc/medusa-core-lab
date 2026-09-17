import { MedusaError, Modules } from "@medusajs/framework/utils"
import { updateCartWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Hook validate cho updateCartWorkflow:
 * 
 * BẢO VỆ NGHIỆP VỤ & TRIỆT TIÊU VẤN ĐỀ 1 ACCOUNT CÓ NHIỀU CART CHƯA COMPLETE:
 * 
 * 1. Ngăn chặn Guest Checkout mạo danh:
 *    - Nếu giỏ hàng là Guest (!cart.customer_id), khách KHÔNG ĐƯỢC PHÉP nhập email
 *      của một tài khoản đã đăng ký (has_account: true).
 *    - Lý do: Tránh việc Medusa tự động gán customer_id cho giỏ guest khi chưa đăng nhập,
 *      dẫn đến việc 1 customer sở hữu nhiều giỏ hàng active cùng lúc, làm hỏng luồng merge cart.
 *    - Đồng thời bảo vệ tài khoản khách hàng, tránh kẻ xấu nhập email của người khác để hưởng ưu đãi.
 * 
 * 2. Ngăn chặn Mismatch Email khi đã đăng nhập:
 *    - Nếu giỏ hàng đã có chủ (cart.customer_id), khách KHÔNG ĐƯỢC nhập email
 *      của một tài khoản khách hàng khác trong hệ thống.
 */
updateCartWorkflow.hooks.validate(
  async ({ input, cart }, { container }) => {
    const emailToValidate = input?.email
    if (!emailToValidate) {
      return
    }

    const normalizedEmail = emailToValidate.trim().toLowerCase()
    const customerService = container.resolve<any>(Modules.CUSTOMER)

    // Tìm xem email này có thuộc về một tài khoản đã đăng ký hay không
    const [registeredCustomer] = await customerService.listCustomers({
      email: normalizedEmail,
      has_account: true,
    })

    if (!registeredCustomer) {
      // Email vãng lai chưa từng đăng ký tài khoản -> Cho phép checkout bình thường
      return
    }

    // Trường hợp 1: Giỏ hàng hiện tại là Guest nhưng nhập email đã có tài khoản
    if (!cart?.customer_id) {
      console.warn(
        `[Hook: validate-cart-email] Chặn guest cart ${cart?.id} nhập email đã có account: ${normalizedEmail}`
      )
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Email này đã được đăng ký tài khoản.",
        "EMAIL_ALREADY_REGISTERED"
      )
    }

    // Trường hợp 2: Giỏ hàng đã có chủ nhưng cố tình đổi sang email của tài khoản khác
    if (registeredCustomer.id !== cart.customer_id) {
      console.warn(
        `[Hook: validate-cart-email] Chặn cart ${cart?.id} (chủ: ${cart.customer_id}) đổi sang email của customer khác: ${normalizedEmail}`
      )
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Email này thuộc về một tài khoản khác.",
        "EMAIL_TAKEN_BY_ANOTHER_CUSTOMER"
      )
    }
  }
)
