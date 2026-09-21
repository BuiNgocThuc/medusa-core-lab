"use client"

import { Heading, Text, clx } from "@modules/common/components/ui"

import PaymentButton from "../payment-button"
import { useSearchParams } from "next/navigation"
import { HttpTypes } from "@medusajs/types"
import { useEffect, useState } from "react"
import { placeOrder } from "@lib/data/cart"
import ErrorMessage from "../error-message"

const Review = ({ cart }: { cart: HttpTypes.StoreCart }) => {
  const searchParams = useSearchParams()
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isOpen = searchParams.get("step") === "review"
  const vnpayReturn = searchParams.get("vnpay_return")
  const momoReturn = searchParams.get("momo_return")

  const isSuccessReturn = vnpayReturn === "success" || momoReturn === "success"

  useEffect(() => {
    if (isOpen && isSuccessReturn && !submitting) {
      setSubmitting(true)
      placeOrder().catch((err) => {
        setErrorMessage(err.message || "Failed to place order after payment")
        setSubmitting(false)
      })
    }
  }, [isOpen, isSuccessReturn, submitting])

  const paidByGiftcard = !!(
    (cart as unknown as Record<string, unknown>)?.gift_cards && ((cart as unknown as Record<string, unknown>)?.gift_cards as unknown[])?.length > 0 && cart?.total === 0
  )

  const previousStepsCompleted =
    cart.shipping_address &&
    (cart.shipping_methods?.length ?? 0) > 0 &&
    (cart.payment_collection || paidByGiftcard)

  return (
    <div className="bg-white">
      <div className="flex flex-row items-center justify-between mb-6">
        <Heading
          level="h2"
          className={clx(
            "flex flex-row text-3xl-regular gap-x-2 items-baseline",
            {
              "opacity-50 pointer-events-none select-none": !isOpen,
            }
          )}
        >
          Review
        </Heading>
      </div>
      {isOpen && previousStepsCompleted && (
        <>
          <div className="flex items-start gap-x-1 w-full mb-6">
            <div className="w-full">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">
                {isSuccessReturn
                  ? "Payment completed successfully! Completing your order..."
                  : "By clicking the Place Order button, you confirm that you have read, understand and accept our Terms of Use, Terms of Sale and Returns Policy and acknowledge that you have read Medusa Store's Privacy Policy."}
              </Text>
            </div>
          </div>
          {isSuccessReturn ? (
            <div className="flex flex-col gap-y-2">
              <Text className="text-ui-fg-subtle">
                Processing your order, please wait...
              </Text>
              <ErrorMessage error={errorMessage} data-testid="review-order-error" />
            </div>
          ) : (
            <PaymentButton cart={cart} data-testid="submit-order-button" />
          )}
        </>
      )}
    </div>
  )
}

export default Review
