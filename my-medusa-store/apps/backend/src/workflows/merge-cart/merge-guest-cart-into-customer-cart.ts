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
  releaseLockStep,
  transferCartCustomerWorkflow,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { MergeGuestCartInput } from "./types"

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
  (input: WorkflowData<MergeGuestCartInput>) => {
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
      ],
    }).config({ name: "get-customer-cart" })

    // Chon cart duoc cap nhat moi nhat
    const customerCartTransform = transform({ customerCart }, ({ customerCart }) => {
      const carts = customerCart.data || []
      if (carts.length === 0) {
        console.log("[Workflow: MergeCart] Customer chua co cart active (Cart A = null)")
        return null
      }

      const activeCart = carts.sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at).getTime()
        const dateB = new Date(b.updated_at || b.created_at).getTime()
        return dateB - dateA
      })[0]

      console.log(`[Workflow: MergeCart] Selected Cart A: ${activeCart.id}`)
      return activeCart
    })

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
    when("has-customer-cart", { customerCartTransform }, ({ customerCartTransform }) => {
      const condition = customerCartTransform !== null
      console.log(`[Workflow: MergeCart] Condition has-customer-cart: ${condition}`)
      return condition
    }).then(() => {
      logStep({
        stage: "Branch: Merge guest cart items into customer cart (TODO)",
      }).config({ name: "log-merge-branch" })
    })

    const result = transform(
      { customerCartTransform, input },
      ({ customerCartTransform, input }) => {
        const finalCartId = customerCartTransform ? customerCartTransform.id : input.guest_cart_id
        console.log(`[Workflow: MergeCart] Done. Result cart_id: ${finalCartId}`)
        return {
          cart_id: finalCartId,
        }
      }
    )

    return new WorkflowResponse(result)
  }
)