import { ModuleProvider, Modules } from "@medusajs/framework/utils"

import VnpayPaymentProviderService from "./service"

export default ModuleProvider(Modules.PAYMENT, {
  services: [VnpayPaymentProviderService],
})
