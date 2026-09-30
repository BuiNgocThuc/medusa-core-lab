'use client'

import { createTransferRequest } from '@lib/data/orders'
import { CheckCircleMiniSolid, XCircleSolid } from '@medusajs/icons'
import { Heading, IconButton, Input, Text } from '@modules/common/components/ui'
import { SubmitButton } from '@modules/checkout/components/submit-button'
import { useActionState, useEffect, useState } from 'react'

const RESEND_TIMEOUT_SECONDS = 120

function formatCountdown(seconds: number): string {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    const formattedMinutes = minutes.toString().padStart(2, '0')
    const formattedSeconds = remainingSeconds.toString().padStart(2, '0')
    return `${formattedMinutes}:${formattedSeconds}`
}

export default function TransferRequestForm() {
    const [showSuccess, setShowSuccess] = useState(false)
    const [countdown, setCountdown] = useState(0)

    const [state, formAction] = useActionState(createTransferRequest, {
        success: false,
        error: null,
        order: null,
    })

    useEffect(() => {
        if (state.success && state.order) {
            setShowSuccess(true)
            setCountdown(RESEND_TIMEOUT_SECONDS)
        }
    }, [state.success, state.order])

    useEffect(() => {
        if (countdown <= 0) {
            return
        }

        const interval = setInterval(() => {
            setCountdown((previous) => {
                if (previous <= 1) {
                    clearInterval(interval)
                    return 0
                }
                return previous - 1
            })
        }, 1000)

        return () => clearInterval(interval)
    }, [countdown])

    const handleDismiss = () => {
        setShowSuccess(false)
    }

    const isCooldownActive = countdown > 0

    return (
        <div className="flex flex-col gap-y-4 w-full">
            <div className="grid sm:grid-cols-2 items-center gap-x-8 gap-y-4 w-full">
                <div className="flex flex-col gap-y-1">
                    <Heading
                        level="h3"
                        className="!text-sm font-semibold text-neutral-950"
                    >
                        Order transfers
                    </Heading>
                    <p className="text-small-regular text-neutral-500">
                        Can&apos;t find the order you are looking for?
                        <br /> Connect an order to your account.
                    </p>
                </div>
                <form
                    action={formAction}
                    className="flex flex-col gap-y-1 sm:items-end"
                >
                    <div className="flex flex-col gap-y-2 w-full">
                        <Input
                            className="w-full"
                            name="order_id"
                            placeholder="Order ID"
                            disabled={isCooldownActive}
                            required
                        />
                        <div className="flex items-center justify-end gap-x-3">
                            {isCooldownActive && (
                                <Text className="text-xs text-neutral-500">
                                    Resend available in {formatCountdown(countdown)}
                                </Text>
                            )}
                            <SubmitButton
                                variant="secondary"
                                size="small"
                                className="w-fit whitespace-nowrap self-end"
                                disabled={isCooldownActive}
                            >
                                Request transfer
                            </SubmitButton>
                        </div>
                    </div>
                </form>
            </div>

            {!state.success && state.error && (
                <Text className="text-base-regular text-rose-500 text-right">
                    {state.error}
                </Text>
            )}

            {showSuccess && (
                <div className="flex justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-md w-full self-stretch items-center">
                    <div className="flex gap-x-3 items-center">
                        <CheckCircleMiniSolid className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                        <div className="flex flex-col gap-y-1">
                            <Text className="text-sm font-medium text-emerald-950">
                                Transfer requested for order {state.order?.id}
                            </Text>
                            <Text className="text-xs text-emerald-800">
                                Transfer request email sent to{' '}
                                <span className="font-semibold">{state.order?.email}</span>. Please check your inbox to confirm.
                            </Text>
                        </div>
                    </div>
                    <IconButton
                        className="h-fit text-emerald-700 hover:text-emerald-950"
                        onClick={handleDismiss}
                    >
                        <XCircleSolid className="w-4 h-4" />
                    </IconButton>
                </div>
            )}
        </div>
    )
}
