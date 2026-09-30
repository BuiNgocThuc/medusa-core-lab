import { retrieveCustomer } from '@lib/data/customer'
import { acceptTransferRequest } from '@lib/data/orders'
import {
    CheckCircleSolid,
    ExclamationCircleSolid,
    XCircleSolid,
} from '@medusajs/icons'
import LocalizedClientLink from '@modules/common/components/localized-client-link'
import { Heading, Text } from '@modules/common/components/ui'
import TransferImage from '@modules/order/components/transfer-image'
import { redirect } from 'next/navigation'

type PageProperties = {
    params: Promise<{ id: string; token: string; countryCode: string }>
}

type TransferOutcome =
    | { type: 'success'; title: string; description: string }
    | { type: 'expired'; title: string; description: string }
    | { type: 'already_transferred'; title: string; description: string }
    | { type: 'error'; title: string; description: string }

function categorizeTransferResult(
    success: boolean,
    orderId: string,
    error: string | null
): TransferOutcome {
    if (success) {
        return {
            type: 'success',
            title: 'Order transferred successfully',
            description: `Order ${orderId} has been successfully transferred to your account and is now visible in your order history.`,
        }
    }

    const normalizedError = (error ?? '').toLowerCase()
    const isExpiredOrInvalid =
        normalizedError.includes('expired') ||
        normalizedError.includes('invalid') ||
        normalizedError.includes('not found') ||
        normalizedError.includes('token')

    if (isExpiredOrInvalid) {
        return {
            type: 'expired',
            title: 'Confirmation link expired or invalid',
            description:
                'This transfer confirmation link is invalid or has expired (exceeded 48 hours). Please sign in to your account and submit a new transfer request.',
        }
    }

    const isAlreadyLinked =
        normalizedError.includes('already') ||
        normalizedError.includes('belongs') ||
        normalizedError.includes('confirmed')

    if (isAlreadyLinked) {
        return {
            type: 'already_transferred',
            title: 'Order already linked',
            description:
                `Order ${orderId} is already associated with your account or has previously been transferred.`,
        }
    }

    return {
        type: 'error',
        title: 'Unable to accept order transfer',
        description:
            error ??
            'An unexpected error occurred while processing the transfer. Please try again later or contact customer support.',
    }
}

export default async function TransferPage(props: PageProperties) {
    const { id, token, countryCode } = await props.params

    const customer = await retrieveCustomer().catch(() => null)
    if (!customer) {
        redirect(
            `/${countryCode}/account?redirect=/order/${id}/transfer/${token}/accept`
        )
    }

    const { success, error } = await acceptTransferRequest(id, token)
    const outcome = categorizeTransferResult(success, id, error)

    return (
        <div className="flex flex-col items-center w-full max-w-xl mx-auto mt-12 mb-24 px-4">
            <div className="mb-6 flex justify-center">
                <TransferImage />
            </div>

            <div className="flex flex-col gap-y-6 w-full text-center items-center">
                {outcome.type === 'success' && (
                    <div className="flex flex-col items-center gap-y-3 p-6 bg-emerald-50 border border-emerald-200 rounded-lg w-full">
                        <CheckCircleSolid className="w-8 h-8 text-emerald-600" />
                        <Heading level="h1" className="text-xl text-emerald-950 font-semibold">
                            {outcome.title}
                        </Heading>
                        <Text className="text-sm text-emerald-800 max-w-md">
                            {outcome.description}
                        </Text>
                        <LocalizedClientLink
                            href="/account/orders"
                            className="mt-3 inline-flex items-center justify-center px-4 py-2 bg-neutral-900 text-white rounded-md text-sm font-medium hover:bg-neutral-800 transition-colors"
                        >
                            View orders in account
                        </LocalizedClientLink>
                    </div>
                )}

                {outcome.type === 'expired' && (
                    <div className="flex flex-col items-center gap-y-3 p-6 bg-amber-50 border border-amber-200 rounded-lg w-full">
                        <ExclamationCircleSolid className="w-8 h-8 text-amber-600" />
                        <Heading level="h1" className="text-xl text-amber-950 font-semibold">
                            {outcome.title}
                        </Heading>
                        <Text className="text-sm text-amber-800 max-w-md">
                            {outcome.description}
                        </Text>
                        <LocalizedClientLink
                            href="/account/orders"
                            className="mt-3 inline-flex items-center justify-center px-4 py-2 bg-neutral-900 text-white rounded-md text-sm font-medium hover:bg-neutral-800 transition-colors"
                        >
                            Request new transfer
                        </LocalizedClientLink>
                    </div>
                )}

                {outcome.type === 'already_transferred' && (
                    <div className="flex flex-col items-center gap-y-3 p-6 bg-neutral-50 border border-neutral-200 rounded-lg w-full">
                        <CheckCircleSolid className="w-8 h-8 text-neutral-600" />
                        <Heading level="h1" className="text-xl text-neutral-950 font-semibold">
                            {outcome.title}
                        </Heading>
                        <Text className="text-sm text-neutral-700 max-w-md">
                            {outcome.description}
                        </Text>
                        <LocalizedClientLink
                            href="/account/orders"
                            className="mt-3 inline-flex items-center justify-center px-4 py-2 bg-neutral-900 text-white rounded-md text-sm font-medium hover:bg-neutral-800 transition-colors"
                        >
                            Go to my orders
                        </LocalizedClientLink>
                    </div>
                )}

                {outcome.type === 'error' && (
                    <div className="flex flex-col items-center gap-y-3 p-6 bg-rose-50 border border-rose-200 rounded-lg w-full">
                        <XCircleSolid className="w-8 h-8 text-rose-600" />
                        <Heading level="h1" className="text-xl text-rose-950 font-semibold">
                            {outcome.title}
                        </Heading>
                        <Text className="text-sm text-rose-800 max-w-md">
                            {outcome.description}
                        </Text>
                        <LocalizedClientLink
                            href="/account/orders"
                            className="mt-3 inline-flex items-center justify-center px-4 py-2 border border-neutral-300 bg-white text-neutral-900 rounded-md text-sm font-medium hover:bg-neutral-50 transition-colors"
                        >
                            Return to account
                        </LocalizedClientLink>
                    </div>
                )}
            </div>
        </div>
    )
}
