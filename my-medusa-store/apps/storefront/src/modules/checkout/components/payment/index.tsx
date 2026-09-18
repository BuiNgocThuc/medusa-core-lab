"use client"
import { RadioGroup } from "@headlessui/react"
import { isBankTransfer, isMomo, isStripeLike, isVnpay, paymentInfoMap } from "@lib/constants"
import { initiatePaymentSession } from "@lib/data/cart"
import { convertToLocale } from "@lib/util/money"
import { CheckCircleSolid, CreditCard } from "@medusajs/icons"
import ErrorMessage from "@modules/checkout/components/error-message"
import PaymentContainer, {
  StripePaymentContainer,
} from "@modules/checkout/components/payment-container"
import Divider from "@modules/common/components/divider"
import {
  Button,
  Container,
  Heading,
  Text,
  clx,
} from "@modules/common/components/ui"
import { HttpTypes } from "@medusajs/types"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

type BankTransferSessionData = {
  payment_reference?: string
  bank_name?: string
  bank_account_number?: string
  bank_account_name?: string
  amount?: number
  currency_code?: string
  expires_at?: string
  instructions?: string
}

type MomoSessionData = {
  momo_order_id?: string
  request_id?: string
  amount?: number
  currency_code?: string
  pay_url?: string
  short_link?: string
  deeplink?: string
  qr_code_url?: string
  deeplink_mini_app?: string
  expires_at?: string
  message?: string
}

type VnpaySessionData = {
  vnp_txn_ref?: string
  amount?: number
  currency_code?: string
  payment_url?: string
  expires_at?: string
}

const Payment = ({
  cart,
  availablePaymentMethods,
}: {
  cart: HttpTypes.StoreCart
  availablePaymentMethods: { id: string }[]
}) => {
  const activeSession = cart.payment_collection?.payment_sessions?.find(
    (paymentSession) =>
      paymentSession.status === "pending" ||
      paymentSession.status === "pending_authorization"
  )

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentComplete, setPaymentComplete] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(
    activeSession?.provider_id ?? ""
  )

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const isOpen = searchParams.get("step") === "payment"

  const setPaymentMethod = async (method: string) => {
    setError(null)
    setSelectedPaymentMethod(method)
      if (
      (isStripeLike(method) || isBankTransfer(method) || isMomo(method) || isVnpay(method)) &&
      activeSession?.provider_id !== method
    ) {
      await initiatePaymentSession(cart, {
        provider_id: method,
      })

      if (isBankTransfer(method) || isMomo(method) || isVnpay(method)) {
        router.refresh()
      }
    }
  }

  const paidByGiftcard = !!(
    (cart as unknown as Record<string, unknown>)?.gift_cards && ((cart as unknown as Record<string, unknown>)?.gift_cards as unknown[])?.length > 0 && cart?.total === 0
  )

  const paymentReady =
    (activeSession && (cart?.shipping_methods?.length ?? 0) !== 0) || paidByGiftcard

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams)
      params.set(name, value)

      return params.toString()
    },
    [searchParams]
  )

  const handleEdit = () => {
    router.push(pathname + "?" + createQueryString("step", "payment"), {
      scroll: false,
    })
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    try {
      const shouldInputPaymentDetails =
        isStripeLike(selectedPaymentMethod) && !activeSession

      const checkActiveSession =
        activeSession?.provider_id === selectedPaymentMethod

      if (!checkActiveSession) {
        await initiatePaymentSession(cart, {
          provider_id: selectedPaymentMethod,
        })
      }

      if (!shouldInputPaymentDetails) {
        return router.push(
          pathname + "?" + createQueryString("step", "review"),
          {
            scroll: false,
          }
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    setError(null)
  }, [isOpen])

  return (
    <div className="bg-white">
      <div className="flex flex-row items-center justify-between mb-6">
        <Heading
          level="h2"
          className={clx(
            "flex flex-row text-3xl-regular gap-x-2 items-baseline",
            {
              "opacity-50 pointer-events-none select-none":
                !isOpen && !paymentReady,
            }
          )}
        >
          Payment
          {!isOpen && paymentReady && <CheckCircleSolid />}
        </Heading>
        {!isOpen && paymentReady && (
          <Text>
            <button
              onClick={handleEdit}
              className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
              data-testid="edit-payment-button"
            >
              Edit
            </button>
          </Text>
        )}
      </div>
      <div>
        <div className={isOpen ? "block" : "hidden"}>
          {!paidByGiftcard && availablePaymentMethods?.length && (
            <>
              <RadioGroup
                value={selectedPaymentMethod}
                onChange={(value: string) => setPaymentMethod(value)}
              >
                {availablePaymentMethods.map((paymentMethod) => (
                  <div key={paymentMethod.id}>
                    {isStripeLike(paymentMethod.id) ? (
                      <StripePaymentContainer
                        paymentProviderId={paymentMethod.id}
                        selectedPaymentOptionId={selectedPaymentMethod}
                        paymentInfoMap={paymentInfoMap}
                        setError={setError}
                        setPaymentComplete={setPaymentComplete}
                      />
                    ) : (
                      <PaymentContainer
                        paymentInfoMap={paymentInfoMap}
                        paymentProviderId={paymentMethod.id}
                        selectedPaymentOptionId={selectedPaymentMethod}
                      >
                        {isBankTransfer(paymentMethod.id) &&
                          selectedPaymentMethod === paymentMethod.id &&
                          activeSession?.provider_id === paymentMethod.id && (
                            <BankTransferDetails
                              data={
                                activeSession.data as BankTransferSessionData
                              }
                            />
                          )}
                        {isMomo(paymentMethod.id) &&
                          selectedPaymentMethod === paymentMethod.id &&
                          activeSession?.provider_id === paymentMethod.id && (
                            <MomoDetails
                              data={activeSession.data as MomoSessionData}
                            />
                          )}
                        {isVnpay(paymentMethod.id) &&
                          selectedPaymentMethod === paymentMethod.id &&
                          activeSession?.provider_id === paymentMethod.id && (
                            <VnpayDetails
                              data={activeSession.data as VnpaySessionData}
                            />
                          )}
                      </PaymentContainer>
                    )}
                  </div>
                ))}
              </RadioGroup>
            </>
          )}

          {paidByGiftcard && (
            <div className="flex flex-col w-1/3">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">
                Payment method
              </Text>
              <Text
                className="txt-medium text-ui-fg-subtle"
                data-testid="payment-method-summary"
              >
                Gift card
              </Text>
            </div>
          )}

          <ErrorMessage
            error={error}
            data-testid="payment-method-error-message"
          />

          <Button
            size="large"
            className="mt-6"
            onClick={handleSubmit}
            isLoading={isLoading}
            disabled={
              (isStripeLike(selectedPaymentMethod) && !paymentComplete) ||
              (!selectedPaymentMethod && !paidByGiftcard)
            }
            data-testid="submit-payment-button"
          >
            {!activeSession && isStripeLike(selectedPaymentMethod)
              ? "Enter payment details"
              : "Continue to review"}
          </Button>
        </div>

        <div className={isOpen ? "hidden" : "block"}>
          {cart && paymentReady && activeSession ? (
            <div className="flex items-start gap-x-1 w-full">
              <div className="flex flex-col w-1/3">
                <Text className="txt-medium-plus text-ui-fg-base mb-1">
                  Payment method
                </Text>
                <Text
                  className="txt-medium text-ui-fg-subtle"
                  data-testid="payment-method-summary"
                >
                  {paymentInfoMap[activeSession?.provider_id]?.title ||
                    activeSession?.provider_id}
                </Text>
              </div>
              <div className="flex flex-col w-1/3">
                <Text className="txt-medium-plus text-ui-fg-base mb-1">
                  Payment details
                </Text>
                <div
                  className="flex gap-2 txt-medium text-ui-fg-subtle items-center"
                  data-testid="payment-details-summary"
                >
                  <Container className="flex items-center h-7 w-fit p-2 bg-ui-button-neutral-hover">
                    {paymentInfoMap[selectedPaymentMethod]?.icon || (
                      <CreditCard />
                    )}
                  </Container>
                  <Text>
                    {isBankTransfer(activeSession.provider_id)
                      ? (
                          activeSession.data as BankTransferSessionData
                        )?.payment_reference
                      : isMomo(activeSession.provider_id)
                      ? "Pay on the next step"
                      : isVnpay(activeSession.provider_id)
                      ? "Pay on the next step"
                      : "Another step will appear"}
                  </Text>
                </div>
              </div>
            </div>
          ) : paidByGiftcard ? (
            <div className="flex flex-col w-1/3">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">
                Payment method
              </Text>
              <Text
                className="txt-medium text-ui-fg-subtle"
                data-testid="payment-method-summary"
              >
                Gift card
              </Text>
            </div>
          ) : null}
        </div>
      </div>
      <Divider className="mt-8" />
    </div>
  )
}

const BankTransferDetails = ({ data }: { data?: BankTransferSessionData }) => {
  if (!data?.payment_reference) {
    return null
  }

  const amount =
    typeof data.amount === "number" && data.currency_code
      ? convertToLocale({
          amount: data.amount,
          currency_code: data.currency_code,
        })
      : undefined
  const expiresAt = data.expires_at
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(data.expires_at))
    : undefined

  return (
    <div className="grid grid-cols-1 small:grid-cols-2 gap-3 rounded-rounded border border-ui-border-base bg-ui-bg-subtle p-4">
      <BankTransferRow label="Amount" value={amount} />
      <BankTransferRow label="Reference" value={data.payment_reference} strong />
      <BankTransferRow label="Bank" value={data.bank_name} />
      <BankTransferRow label="Account number" value={data.bank_account_number} />
      <BankTransferRow label="Account name" value={data.bank_account_name} />
      <BankTransferRow label="Expires" value={expiresAt} />
    </div>
  )
}

const MomoDetails = ({ data }: { data?: MomoSessionData }) => {
  if (!data?.pay_url && !data?.short_link && !data?.deeplink) {
    return null
  }

  const amount =
    typeof data.amount === "number" && data.currency_code
      ? convertToLocale({
          amount: data.amount,
          currency_code: data.currency_code,
        })
      : undefined
  const expiresAt = data.expires_at
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(data.expires_at))
    : undefined

  return (
    <div className="grid grid-cols-1 small:grid-cols-2 gap-3 rounded-rounded border border-ui-border-base bg-ui-bg-subtle p-4">
      <BankTransferRow label="Amount" value={amount} />
      <BankTransferRow label="Expires" value={expiresAt} />
      <BankTransferRow label="Method" value="MoMo wallet" strong />
    </div>
  )
}

const VnpayDetails = ({ data }: { data?: VnpaySessionData }) => {
  if (!data?.payment_url) {
    return null
  }

  const amount =
    typeof data.amount === "number" && data.currency_code
      ? convertToLocale({
          amount: data.amount,
          currency_code: data.currency_code,
        })
      : undefined
  const expiresAt = data.expires_at
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(data.expires_at))
    : undefined

  return (
    <div className="grid grid-cols-1 small:grid-cols-2 gap-3 rounded-rounded border border-ui-border-base bg-ui-bg-subtle p-4">
      <BankTransferRow label="Amount" value={amount} />
      <BankTransferRow label="Expires" value={expiresAt} />
      <BankTransferRow label="Method" value="VNPay gateway" strong />
    </div>
  )
}

const BankTransferRow = ({
  label,
  value,
  strong = false,
}: {
  label: string
  value?: string
  strong?: boolean
}) => {
  if (!value) {
    return null
  }

  return (
    <div>
      <Text className="txt-small text-ui-fg-muted">{label}</Text>
      <Text
        className={clx("txt-medium text-ui-fg-base break-words", {
          "txt-medium-plus": strong,
        })}
      >
        {value}
      </Text>
    </div>
  )
}

export default Payment
