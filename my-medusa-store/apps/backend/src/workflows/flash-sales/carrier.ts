export function isFlashSaleCarrier(promotion: any) {
  return promotion.metadata?.source === "flash-sale-schedule" && promotion.metadata?.flash_carrier === true
}
