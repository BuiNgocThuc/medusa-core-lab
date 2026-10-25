import { MedusaError, Modules } from "@medusajs/framework/utils"
import { MedusaContainer } from "@medusajs/framework/types"

/**
 * Helper function (plain async) — dùng trực tiếp trong hook handler.
 *
 * BẢO VỆ NGHIỆP VỤ:
 * 1. Guest cart nhập email đã có tài khoản → Chặn (tránh auto-assign customer_id)
 * 2. Cart đã có chủ cố đổi sang email của customer khác → Chặn
 */
export async function validateCartEmail(
  {
    email,
    cart_id,
    customer_id,
  }: {
    email: string | null | undefined
    cart_id: string | null | undefined
    customer_id: string | null | undefined
  },
  container: MedusaContainer
): Promise<void> {
  if (!email) return

  const normalizedEmail = email.trim().toLowerCase()
  const customerService = container.resolve<any>(Modules.CUSTOMER)

  const [registeredCustomer] = await customerService.listCustomers({
    email: normalizedEmail,
    has_account: true,
  })

  if (!registeredCustomer) return

  // Trường hợp 1: Guest cart nhập email đã có tài khoản
  if (!customer_id) {
    console.warn(
      `[Hook: validate-cart-email] Chặn guest cart ${cart_id} nhập email đã có account: ${normalizedEmail}`
    )
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Email này đã được đăng ký tài khoản.",
      "EMAIL_ALREADY_REGISTERED"
    )
  }

  // Trường hợp 2: Cart đã có chủ cố đổi sang email của customer khác
  if (registeredCustomer.id !== customer_id) {
    console.warn(
      `[Hook: validate-cart-email] Chặn cart ${cart_id} (chủ: ${customer_id}) đổi sang email của customer khác: ${normalizedEmail}`
    )
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Email này thuộc về một tài khoản khác.",
      "EMAIL_TAKEN_BY_ANOTHER_CUSTOMER"
    )
  }
}
