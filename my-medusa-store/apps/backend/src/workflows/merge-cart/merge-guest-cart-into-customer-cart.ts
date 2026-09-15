import {createStep, createWorkflow,StepResponse,
    transform,when,WorkflowData,WorkflowResponse} 
from "@medusajs/framework/workflows-sdk";
import { MergeGuestCartInput } from "./types";
import { useQueryGraphStep } from "@medusajs/medusa/core-flows";
import {
  transferCartCustomerWorkflow,
  acquireLockStep,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { logCustomerCartStep } from "../logs/steps/log-customer-cart";

export const mergeGuestCartIntoCustomerCartWorkflow = createWorkflow(
  "merge-guest-cart-into-customer-cart",
  (input: WorkflowData<MergeGuestCartInput>) => {

    const cartQuery = useQueryGraphStep({
    entity: "cart",
    filters: { customer_id: input.customer_id }, 
    fields: [
        "id",
        "email",
        "customer_id",
        "customer.has_account",
        "shipping_address.*",
        "region.*",
        "region.countries.*",
    ],
    }).config({ name: "get-customer-cart" })

    logCustomerCartStep(cartQuery)
    
    // Trong transform để lấy cart active
    const customerCart = transform({ cartQuery }, ({ cartQuery }) => {
    const found = cartQuery.data?.find((cart) => !cart.completed_at) ?? null
    // Log the raw query result and the selected active cart for tracing
    // eslint-disable-next-line no-console
    console.log("workflow:get-customer-cart:cartQuery.data", { data: cartQuery.data })
    // eslint-disable-next-line no-console
    console.log("workflow:get-customer-cart:customerCartFound", { found })
    return found
    })


    console.log("customerCart", customerCart)
        // IF customerCart === null → chạy transferCartCustomerWorkflow
    // Nhớ lock ra ngoài vì nested workflow không tự acquire lock
   
    when("no-customer-cart", { customerCart }, ({ customerCart }) => {
      return customerCart === null
    }).then(() => {
      acquireLockStep({ 
        key: input.guest_cart_id, 
        timeout: 30, 
        ttl: 120 
      })
    console.log("run transferCartCustomerWorkflow");
      transferCartCustomerWorkflow.runAsStep({
        input: {
          id: input.guest_cart_id,
          customer_id: input.customer_id,
        },
      })

      releaseLockStep({ key: input.guest_cart_id })
    })

    // IF customerCart exists → merge logic
    when("has-customer-cart", { customerCart }, ({ customerCart }) => {
      return customerCart !== null
    }).then(() => {
      // ... merge logic ở đây
      console.log("Merging guest cart into customer cart:"
        , input.guest_cart_id, "into", customerCart.id)
    })


    return new WorkflowResponse({})
  }
)