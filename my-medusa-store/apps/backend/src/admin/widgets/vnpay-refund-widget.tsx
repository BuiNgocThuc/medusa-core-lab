/**
 * Admin UI Widget cho VNPay Refund:
 * - Hiển thị trong trang chi tiết đơn hàng (zone order.details.side.after) nếu dùng VNPay.
 * - Xem audit refund & gửi yêu cầu refund thông qua Medusa Admin API.
 */
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { AdminOrder, AdminPayment, AdminPaymentCollection } from "@medusajs/types"
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Label,
  StatusBadge,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"

type OrderWithPayments = AdminOrder & {
  payment_collection?: AdminPaymentCollection & {
    payments?: AdminPaymentWithRefunds[]
    payment_sessions?: PaymentSession[]
  }
  payment_collections?: Array<
    AdminPaymentCollection & {
      payments?: AdminPaymentWithRefunds[]
      payment_sessions?: PaymentSession[]
    }
  >
}

type AdminPaymentWithRefunds = AdminPayment & {
  refunds?: Array<{
    amount?: number
  }>
}

type PaymentSession = {
  id: string
  provider_id?: string
}

type VnpayRefund = {
  id: string
  request_id: string
  amount: number
  transaction_type: string
  status: "pending" | "processing" | "succeeded" | "failed" | "manual_review"
  response_code?: string | null
  transaction_status?: string | null
  refund_transaction_no?: string | null
  created_at?: string
}

type AuditResponse = {
  payment: {
    id: string
    amount: number
    currency_code: string
    status: string
    vnp_txn_ref: string
    transaction_no?: string | null
    pay_date?: string | null
  }
  refunds: VnpayRefund[]
}

const VnpayRefundWidget = ({ data }: { data: OrderWithPayments }) => {
  const paymentCollection = getPaymentCollection(data)
  const payment = paymentCollection?.payments?.find((candidate) =>
    candidate.provider_id?.startsWith("pp_vnpay")
  )
  const paymentSession = paymentCollection?.payment_sessions?.find((session) =>
    session.provider_id?.startsWith("pp_vnpay")
  )
  const paymentSessionId =
    payment?.payment_session_id ?? paymentSession?.id ?? undefined
  const currencyCode = payment?.currency_code ?? data.currency_code
  const refundedAmount = useMemo(
    () =>
      payment?.refunds?.reduce(
        (total, refund) => total + Number(refund.amount ?? 0),
        0
      ) ?? 0,
    [payment?.refunds]
  )
  const refundableAmount = Math.max(Number(payment?.amount ?? 0) - refundedAmount, 0)

  const [audit, setAudit] = useState<AuditResponse | null>(null)
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [isLoadingAudit, setIsLoadingAudit] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!paymentSessionId) {
      return
    }

    void loadAudit(paymentSessionId, setAudit, setIsLoadingAudit)
  }, [paymentSessionId])

  if (!payment || !paymentSessionId) {
    return null
  }

  const parsedAmount = Number(amount)
  const canSubmit =
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    parsedAmount <= refundableAmount &&
    !isSubmitting

  const handleRefund = async () => {
    if (!canSubmit) {
      return
    }

    setIsSubmitting(true)

    try {
      await postAdmin(`/admin/payments/${payment.id}/refund`, {
        amount: parsedAmount,
        note: note || undefined,
      })
      toast.success("VNPay refund submitted")
      setAmount("")
      setNote("")
      await loadAudit(paymentSessionId, setAudit, setIsLoadingAudit)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "VNPay refund failed")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between gap-x-3 px-6 py-4">
        <div>
          <Heading level="h2">VNPay Refund</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {audit?.payment.vnp_txn_ref ?? paymentSessionId}
          </Text>
        </div>
        <StatusBadge color={getStatusColor(audit?.payment.status)}>
          {audit?.payment.status ?? "loading"}
        </StatusBadge>
      </div>

      <div className="grid grid-cols-2 gap-3 px-6 py-4">
        <Metric label="Paid" value={formatMoney(Number(payment.amount ?? 0), currencyCode)} />
        <Metric label="Refundable" value={formatMoney(refundableAmount, currencyCode)} />
        <Metric label="VNPay trans" value={audit?.payment.transaction_no ?? "-"} />
        <Metric label="Pay date" value={formatCompactDate(audit?.payment.pay_date)} />
      </div>

      <div className="flex flex-col gap-y-3 px-6 py-4">
        <div className="flex flex-col gap-y-1">
          <Label htmlFor="vnpay-refund-amount">Amount</Label>
          <Input
            id="vnpay-refund-amount"
            type="number"
            min={0}
            max={refundableAmount}
            step={currencyCode?.toLowerCase() === "vnd" ? 1 : 0.01}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={formatMoney(refundableAmount, currencyCode)}
          />
        </div>

        <div className="flex flex-col gap-y-1">
          <Label htmlFor="vnpay-refund-note">Note</Label>
          <Textarea
            id="vnpay-refund-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
          />
        </div>

        <Button
          size="small"
          type="button"
          isLoading={isSubmitting}
          disabled={!canSubmit}
          onClick={handleRefund}
        >
          Refund with VNPay
        </Button>
      </div>

      <div className="flex flex-col gap-y-3 px-6 py-4">
        <div className="flex items-center justify-between">
          <Text size="small" weight="plus">
            Refund history
          </Text>
          {isLoadingAudit && (
            <Text size="xsmall" className="text-ui-fg-muted">
              Loading
            </Text>
          )}
        </div>

        {audit?.refunds.length ? (
          <div className="flex flex-col gap-y-2">
            {audit.refunds.map((refund) => (
              <div
                key={refund.id}
                className="border-ui-border-base bg-ui-bg-subtle flex flex-col gap-y-2 rounded-md border p-3"
              >
                <div className="flex items-center justify-between gap-x-2">
                  <Text size="small" weight="plus">
                    {formatMoney(refund.amount, currencyCode)}
                  </Text>
                  <StatusBadge color={getStatusColor(refund.status)}>
                    {refund.status}
                  </StatusBadge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge size="xsmall" color="grey">
                    {refund.transaction_type === "02" ? "Full" : "Partial"}
                  </Badge>
                  {refund.response_code && (
                    <Badge size="xsmall" color="grey">
                      RC {refund.response_code}
                    </Badge>
                  )}
                  {refund.transaction_status && (
                    <Badge size="xsmall" color="grey">
                      TS {refund.transaction_status}
                    </Badge>
                  )}
                </div>
                <Text size="xsmall" className="text-ui-fg-muted break-all">
                  {refund.request_id}
                </Text>
              </div>
            ))}
          </div>
        ) : (
          <Text size="small" className="text-ui-fg-subtle">
            No VNPay refunds yet.
          </Text>
        )}
      </div>
    </Container>
  )
}

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="flex min-w-0 flex-col gap-y-1">
    <Text size="xsmall" className="text-ui-fg-muted">
      {label}
    </Text>
    <Text size="small" weight="plus" className="truncate">
      {value}
    </Text>
  </div>
)

function getPaymentCollection(order: OrderWithPayments) {
  return order.payment_collection ?? order.payment_collections?.[0]
}

async function loadAudit(
  paymentSessionId: string,
  setAudit: (audit: AuditResponse | null) => void,
  setIsLoading: (value: boolean) => void
) {
  setIsLoading(true)

  try {
    const response = await fetch(
      `/admin/vnpay-refunds?payment_session_id=${encodeURIComponent(paymentSessionId)}`,
      {
        credentials: "include",
      }
    )

    if (response.status === 404) {
      setAudit(null)
      return
    }

    if (!response.ok) {
      throw new Error(await getErrorMessage(response))
    }

    setAudit((await response.json()) as AuditResponse)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Could not load VNPay refunds")
  } finally {
    setIsLoading(false)
  }
}

async function postAdmin(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(await getErrorMessage(response))
  }

  return response.json()
}

async function getErrorMessage(response: Response) {
  const data = (await response.json().catch(() => null)) as
    | { message?: string }
    | null

  return data?.message ?? `Request failed with HTTP ${response.status}`
}

function formatMoney(amount: number, currencyCode?: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currencyCode?.toUpperCase() ?? "VND",
    maximumFractionDigits: currencyCode?.toLowerCase() === "vnd" ? 0 : 2,
  }).format(amount)
}

function formatCompactDate(value?: string | null) {
  if (!value) {
    return "-"
  }

  if (/^\d{14}$/.test(value)) {
    return `${value.slice(6, 8)}/${value.slice(4, 6)}/${value.slice(0, 4)} ${value.slice(8, 10)}:${value.slice(10, 12)}`
  }

  return value
}

function getStatusColor(status?: string | null) {
  if (status === "paid" || status === "succeeded" || status === "refunded") {
    return "green"
  }

  if (status === "processing" || status === "partially_refunded") {
    return "blue"
  }

  if (status === "failed" || status === "manual_review") {
    return "red"
  }

  return "grey"
}

export const config = defineWidgetConfig({
  zone: "order.details.side.after",
  id: "vnpay-refund-widget",
})

export default VnpayRefundWidget
