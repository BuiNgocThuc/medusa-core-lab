import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createCartWorkflow } from "@medusajs/medusa/core-flows"
import { HELLO_MODULE } from "../../modules/hello"
import HelloModuleService from "../../modules/hello/service"
import { Link } from "@medusajs/framework/modules-sdk"

createCartWorkflow.hooks.cartCreated(
  async ({ cart, additional_data }, { container }) => {
    const helloModuleService: HelloModuleService = container.resolve(HELLO_MODULE)
    
    const link = container.resolve<Link>(  // ← dùng Link type
      ContainerRegistrationKeys.LINK
    )

    const custom = await helloModuleService.createCustoms({
      custom_name: additional_data?.custom_name as string ?? "default",
    })

    await link.create({
      [Modules.CART]: { cart_id: cart.id },
      [HELLO_MODULE]: { custom_id: custom.id || "sdasdasd"},
    })
  }
)