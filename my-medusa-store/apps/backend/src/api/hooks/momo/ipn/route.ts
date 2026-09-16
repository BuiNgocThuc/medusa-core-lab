import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { getMomoDevOptions } from "../../../../lib/momo-dev"
import MomoPaymentProviderService from "../../../../modules/momo/service"
import type { MomoIpnPayload } from "../../../../modules/momo/types"
import { MOMO_PAYMENT_MODULE } from "../../../../modules/momo-payment"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const provider = new MomoPaymentProviderService(
    {
      logger: req.scope.resolve("logger"),
      [MOMO_PAYMENT_MODULE]: req.scope.resolve(MOMO_PAYMENT_MODULE),
    },
    getMomoDevOptions()
  )
  const result = await provider.processIpn((req.body ?? {}) as MomoIpnPayload)

  res.status(200).json({
    received: true,
    ...result,
  })
}
