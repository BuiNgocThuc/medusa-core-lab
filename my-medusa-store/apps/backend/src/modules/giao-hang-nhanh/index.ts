import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import GiaoHangNhanhProviderService from "./service"

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [GiaoHangNhanhProviderService],
})

export { GiaoHangNhanhProviderService }
export * from "./types"
