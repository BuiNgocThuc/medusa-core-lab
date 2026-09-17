
import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  when,
  WorkflowData,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  addToCartWorkflow,
  releaseLockStep,
  transferCartCustomerWorkflow,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { MergeGuestCartInput, MergeGuestCartOutput } from "./types"
import { validateInventoryForMergeStep } from "./steps/validate-inventory-for-merge"
import { deleteCartStep } from "./steps/delete-cart"

const logStep = createStep(
  "log-step",
  async (input: { stage: string; payload?: any }) => {
    console.log(`[Workflow: MergeCart] ${input.stage}`)
    if (input.payload !== undefined) {
      console.dir(input.payload, { depth: 4, colors: true })
    }
    return new StepResponse(true)
  }
)

export const mergeGuestCartIntoCustomerCartWorkflow = createWorkflow(
  "merge-guest-cart-into-customer-cart",
  (input: WorkflowData<MergeGuestCartInput>): WorkflowResponse<MergeGuestCartOutput> => {
    logStep({
      stage: "Started",
      payload: input,
    }).config({ name: "log-start" })

    // Tim gio hang chua checkout cua customer (Cart A)
    const customerCart = useQueryGraphStep({
      entity: "cart",
      filters: {
        customer_id: input.customer_id,
        completed_at: null,
      },
      fields: [
        "id",
        "email",
        "customer_id",
        "currency_code",
        "region_id",
        "sales_channel_id",
        "completed_at",
        "created_at",
        "updated_at",
        "items.id",
        "items.title",
        "items.variant_title",
        "items.variant_id",
        "items.quantity",
      ],
    }).config({ name: "get-customer-cart" })

    // Chon cart duoc cap nhat moi nhat (NGOẠI TRỪ guest_cart_id)
    const customerCartTransform = transform(
      { customerCart, input },
      ({ customerCart, input }) => {
        const carts = customerCart.data || []

        // BẮT BUỘC: Loại trừ chính guest_cart_id ra khỏi danh sách tìm kiếm Cart A!
        // Lý do: Nếu trước khi login, guest đã vào trang checkout và điền email,
        // Medusa Core (findOrCreateCustomerStep) có thể đã tự động gán customer_id cho guest_cart này.
        // Khi đó, guest_cart cũng mang customer_id và có updated_at mới hơn Cart A cũ.
        // Nếu không loại trừ, hệ thống sẽ chọn nhầm guest_cart làm Cart A -> tự gộp vào chính mình (self-merge bug)!
        const otherCarts = carts.filter((c) => c.id !== input.guest_cart_id)

        if (otherCarts.length === 0) {
          console.log(
            "[Workflow: MergeCart] Customer chua co cart active nao khac (Cart A = null). Cart hien tai la cart duy nhat."
          )
          return null
        }

        const activeCart = otherCarts.sort((a, b) => {
          const dateA = new Date(a.updated_at || a.created_at).getTime()
          const dateB = new Date(b.updated_at || b.created_at).getTime()
          return dateB - dateA
        })[0]

        console.log(`[Workflow: MergeCart] Selected Cart A: ${activeCart.id}`)
        return activeCart
      }
    )

    // Nhanh 1: Khach chua co Cart A va co guest_cart_id -> Transfer guest cart sang customer
    when("transfer-guest-cart", { customerCartTransform, input }, ({ customerCartTransform, input }) => {
      const condition = customerCartTransform === null && !!input.guest_cart_id
      console.log(`[Workflow: MergeCart] Condition transfer-guest-cart: ${condition}`)
      return condition
    }).then(() => {
      logStep({
        stage: "Branch: Transfer guest cart to customer",
        payload: { guest_cart_id: input.guest_cart_id, customer_id: input.customer_id },
      }).config({ name: "log-transfer-start" })

      acquireLockStep({
        key: input.guest_cart_id!,
        timeout: 30,
        ttl: 120,
      })

      transferCartCustomerWorkflow.runAsStep({
        input: {
          id: input.guest_cart_id!,
          customer_id: input.customer_id,
        },
      })

      releaseLockStep({ key: input.guest_cart_id! })

      logStep({
        stage: "Branch: Transfer guest cart completed",
      }).config({ name: "log-transfer-done" })
    })

    // Nhanh 2: Khach da co Cart A -> Merge line items tu Cart B vao Cart A
    const mergeBranchResult = when("has-customer-cart", { customerCartTransform }, ({ customerCartTransform }) => {
      const condition = customerCartTransform !== null
      console.log(`[Workflow: MergeCart] Condition has-customer-cart: ${condition}`)
      return condition
    }).then(() => {
      logStep({
        stage: "Branch: Merge guest cart items into customer cart",
      }).config({ name: "log-merge-branch" })

      acquireLockStep({
        key: [customerCartTransform.id, input.guest_cart_id!],
        timeout: 30,
        ttl: 120,
      }).config({ name: "acquire-merge-locks" })

      const guestCart = useQueryGraphStep({
        entity: "cart",
        filters: {
          id: input.guest_cart_id,
        },
        fields: [
          "id",
          "completed_at",
          "currency_code",
          "region_id",
          "sales_channel_id",
          "items.id",
          "items.title",
          "items.variant_title",
          "items.variant_id",
          "items.quantity",
          "items.metadata",
        ],
        options: {
          isList: false,
        },
      }).config({ name: "get-guest-cart" })

      // Chuan bi input de validate inventory (gom ca Cart A va Cart B)
      const validationInput = transform(
        { customerCartTransform, guestCart },
        ({ customerCartTransform, guestCart }) => {
          const guestItems = (guestCart.data?.items ?? [])
            .filter((item) => Boolean(item?.variant_id))
            .map((item) => ({
              id: item!.id,
              variant_id: item!.variant_id!,
              quantity: item!.quantity,
              title: item!.title,
              variant_title: item!.variant_title,
              metadata: (item!.metadata as Record<string, unknown>) ?? undefined,
            }))

          const existingItems = (customerCartTransform?.items ?? [])
            .filter((item: any) => Boolean(item?.variant_id))
            .map((item: any) => ({
              id: item.id,
              variant_id: item.variant_id,
              quantity: item.quantity,
              title: item.title,
              variant_title: item.variant_title,
            }))

          return {
            sales_channel_id: customerCartTransform?.sales_channel_id,
            guest_items: guestItems,
            existing_items: existingItems,
          }
        }
      )

      // Validate inventory: tinh tong Cart A + Cart B truoc khi them vao
      const inventoryValidationResult = validateInventoryForMergeStep(validationInput).config({
        name: "validate-inventory-for-merge-step",
      })

      // Chi add vao cart nhung items hop le (valid_items)
      addToCartWorkflow.runAsStep({
        input: {
          cart_id: customerCartTransform.id,
          items: inventoryValidationResult.valid_items,
        },
      })

      // BẮT BUỘC: Dọn dẹp Cart B sau khi đã gộp các mặt hàng hợp lệ vào Cart A!
      // Lý do:
      // 1. Tránh việc một tài khoản tồn tại song song 2 giỏ hàng active trong DB.
      // 2. Tránh xung đột multi-device (thiết bị A bốc nhầm Cart B cũ, thiết bị B bốc Cart A mới).
      // 3. Đảm bảo toàn bộ hệ thống (Storefront, Analytics, Abandoned Cart) chỉ xem Cart A là giỏ hàng duy nhất của user.
      deleteCartStep({
        cart_id: input.guest_cart_id!,
      }).config({ name: "delete-merged-guest-cart" })

      // Mo khoa ca 2 cart
      releaseLockStep({
        key: [customerCartTransform.id, input.guest_cart_id],
      }).config({ name: "release-merge-locks" })

      return inventoryValidationResult
    })

    const result = transform(
      { customerCartTransform, input, mergeBranchResult },
      ({ customerCartTransform, input, mergeBranchResult }) => {
        const finalCartId = customerCartTransform ? customerCartTransform.id : input.guest_cart_id
        const skipped_items = (mergeBranchResult as any)?.skipped_items ?? []
        console.log(
          `[Workflow: MergeCart] Done. Result cart_id: ${finalCartId}, skipped_items count: ${skipped_items.length}`
        )
        return {
          cart_id: finalCartId,
          skipped_items,
        }
      }
    )

    return new WorkflowResponse(result)
  }
)