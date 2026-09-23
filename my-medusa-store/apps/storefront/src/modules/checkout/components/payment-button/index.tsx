"use client"
/**
 * Nút thanh toán cuối ở bước review checkout:
 * - Quyết định: placeOrder ngay (Manual / Bank Transfer), confirm Stripe, hoặc redirect sang cổng MoMo / VNPay.
 */

import { isBankTransfer, isManual, isMomo, isStripeLike, isVnpay } from "@lib/constants"
import { placeOrder } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import { Button } from "@modules/common/components/ui"
import { useElements, useStripe } from "@stripe/react-stripe-js"
import { useParams } from "next/navigation"
import React, { useState } from "react"
import ErrorMessage from "../error-message"

type PaymentButtonProps = {
  cart: HttpTypes.StoreCart
  "data-testid": string
}

const PaymentButton: React.FC<PaymentButtonProps> = ({
  cart,
  "data-testid": dataTestId,
}) => {
  const notReady =
    !cart ||
    !cart.shipping_address ||
    !cart.billing_address ||
    !cart.email ||
    (cart.shipping_methods?.length ?? 0) < 1

  const paymentSession = cart.payment_collection?.payment_sessions?.find(
    (session) =>
      session.status === "pending" ||
      session.status === "pending_authorization"
  )

  switch (true) {
    case isStripeLike(paymentSession?.provider_id):
      return (
        <StripePaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}
        />
      )
    case isManual(paymentSession?.provider_id):
      return (
        <ManualTestPaymentButton notReady={notReady} data-testid={dataTestId} />
      )
    case isBankTransfer(paymentSession?.provider_id):
      return (
        <BankTransferPaymentButton
          notReady={notReady}
          data-testid={dataTestId}
        />
      )
    case isMomo(paymentSession?.provider_id):
      return (
        <MomoPaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}
        />
      )
    case isVnpay(paymentSession?.provider_id):
      return (
        <VnpayPaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}
        />
      )
    default:
      return <Button disabled>Select a payment method</Button>
  }
}

const StripePaymentButton = ({
  cart,
  notReady,
  "data-testid": dataTestId,
}: {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const onPaymentCompleted = async () => {
    await placeOrder()
      .catch((err) => {
        setErrorMessage(err.message)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const stripe = useStripe()
  const elements = useElements()
  const { countryCode } = useParams()

  const disabled = !stripe || !elements ? true : false

  const handlePayment = async () => {
    if (!stripe || !elements || !cart) {
      return
    }

    setSubmitting(true)

    await stripe
      .confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/api/payment-return?cart_id=${cart.id}&country_code=${countryCode}`,
          payment_method_data: {
            billing_details: {
              name:
                cart.billing_address?.first_name +
                " " +
                cart.billing_address?.last_name,
              address: {
                city: cart.billing_address?.city ?? undefined,
                country: cart.billing_address?.country_code ?? undefined,
                line1: cart.billing_address?.address_1 ?? undefined,
                line2: cart.billing_address?.address_2 ?? undefined,
                postal_code: cart.billing_address?.postal_code ?? undefined,
                state: cart.billing_address?.province ?? undefined,
              },
              email: cart.email,
              phone: cart.billing_address?.phone ?? undefined,
            },
          },
        },
        // Only leave the site when the selected method actually requires it, so
        // card payments still complete inline.
        redirect: "if_required",
      })
      .then(({ error, paymentIntent }) => {
        if (error) {
          const pi = error.payment_intent

          if (
            (pi && pi.status === "requires_capture") ||
            (pi && pi.status === "succeeded")
          ) {
            onPaymentCompleted()
            return
          }

          setErrorMessage(error.message || null)
          setSubmitting(false)
          return
        }

        if (
          paymentIntent.status === "requires_capture" ||
          paymentIntent.status === "succeeded"
        ) {
          onPaymentCompleted()
          return
        }

        setSubmitting(false)
      })
  }

  return (
    <>
      <Button
        disabled={disabled || notReady}
        onClick={handlePayment}
        size="large"
        isLoading={submitting}
        data-testid={dataTestId}
      >
        Place order
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="stripe-payment-error-message"
      />
    </>
  )
}

const ManualTestPaymentButton = ({ notReady }: { notReady: boolean }) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const onPaymentCompleted = async () => {
    await placeOrder()
      .catch((err) => {
        setErrorMessage(err.message)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const handlePayment = () => {
    setSubmitting(true)

    onPaymentCompleted()
  }

  return (
    <>
      <Button
        disabled={notReady}
        isLoading={submitting}
        onClick={handlePayment}
        size="large"
        data-testid="submit-order-button"
      >
        Place order
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="manual-payment-error-message"
      />
    </>
  )
}

const BankTransferPaymentButton = ({
  notReady,
  "data-testid": dataTestId,
}: {
  notReady: boolean
  "data-testid"?: string
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handlePayment = async () => {
    setSubmitting(true)

    await placeOrder()
      .catch((err) => {
        setErrorMessage(err.message)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  return (
    <>
      <Button
        disabled={notReady}
        isLoading={submitting}
        onClick={handlePayment}
        size="large"
        data-testid={dataTestId}
      >
        Place order and pay by bank transfer
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="bank-transfer-payment-error-message"
      />
    </>
  )
}

export default PaymentButton

const MomoPaymentButton = ({
  cart,
  notReady,
  "data-testid": dataTestId,
}: {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { countryCode } = useParams()
  const paymentSession = cart.payment_collection?.payment_sessions?.find(
    (session) => isMomo(session.provider_id)
  )
  const hostedPaymentUrl =
    (paymentSession?.data?.pay_url as string | undefined) ??
    (paymentSession?.data?.short_link as string | undefined)
  const deeplink = paymentSession?.data?.deeplink as string | undefined
  const paymentUrl =
    typeof window !== "undefined" &&
    /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent) &&
    deeplink
      ? deeplink
      : hostedPaymentUrl

  const handlePayment = () => {
    if (!paymentUrl) {
      setErrorMessage("MoMo payment URL is not available")
      return
    }

    setSubmitting(true)
    window.location.href = withReturnContext(paymentUrl, {
      cart_id: cart.id,
      country_code: typeof countryCode === "string" ? countryCode : "",
    })
  }

  return (
    <>
      <Button
        disabled={notReady || !paymentUrl}
        isLoading={submitting}
        onClick={handlePayment}
        size="large"
        data-testid={dataTestId}
      >
        Pay with MoMo
      </Button>
      <ErrorMessage error={errorMessage} data-testid="momo-payment-error-message" />
    </>
  )
}

function withReturnContext(
  paymentUrl: string,
  context: { cart_id: string; country_code: string }
) {
  try {
    const url = new URL(paymentUrl)
    url.searchParams.set("cart_id", context.cart_id)

    if (context.country_code) {
      url.searchParams.set("country_code", context.country_code)
    }

    return url.toString()
  } catch {
    return paymentUrl
  }
}

const VnpayPaymentButton = ({
  cart,
  notReady,
  "data-testid": dataTestId,
}: {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const paymentSession = cart.payment_collection?.payment_sessions?.find(
    (session) => isVnpay(session.provider_id)
  )
  const paymentUrl = paymentSession?.data?.payment_url as string | undefined

  const handlePayment = () => {
    if (!paymentUrl) {
      setErrorMessage("VNPay payment URL is not available")
      return
    }

    setSubmitting(true)
    window.location.href = paymentUrl
  }

  return (
    <>
      <Button
        disabled={notReady || !paymentUrl}
        isLoading={submitting}
        onClick={handlePayment}
        size="large"
        data-testid={dataTestId}
      >
        Pay with VNPay
      </Button>
      <ErrorMessage error={errorMessage} data-testid="vnpay-payment-error-message" />
    </>
  )
}
