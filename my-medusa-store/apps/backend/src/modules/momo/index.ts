import { ModuleProvider, Modules } from "@medusajs/framework/utils"

import MomoPaymentProviderService from "./service"

export default ModuleProvider(Modules.PAYMENT, {
  services: [MomoPaymentProviderService],
})
