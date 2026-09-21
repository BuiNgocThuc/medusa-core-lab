import { MedusaError } from "@medusajs/framework/utils"

export function throwInvalidPromotion(message: string): never {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, message)
}
