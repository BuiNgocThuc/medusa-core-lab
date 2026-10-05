'use server'

import { sdk } from '@lib/config'
import { getAuthHeaders, getCacheTag, getCartId } from '@lib/data/cookies'
import { revalidateTag } from 'next/cache'

export type ActiveFlashSale = { code: string; percentage: number; max_discount_amount: number; ends_at: string; timezone: string }

export async function listActiveFlashSales(): Promise<ActiveFlashSale[]> {
    return sdk.client.fetch<{ flash_sales: ActiveFlashSale[] }>('/store/flash-sales', { method: 'GET', cache: 'no-store' }).then((response) => response.flash_sales).catch(() => [])
}

export async function claimFlashSale(code: string) {
    const cartId = await getCartId()
    if (!cartId) throw new Error('Add an item to your cart before claiming Flash Sale.')
    const result = await sdk.client.fetch(`/store/carts/${cartId}/flash-sales/claim`, { method: 'POST', body: { code }, headers: { ...(await getAuthHeaders()) }, cache: 'no-store' })
    const cartTag = await getCacheTag('carts')
    if (cartTag) revalidateTag(cartTag)
    return result
}

export async function removeFlashSaleClaim() {
    const cartId = await getCartId()
    if (!cartId) return null
    const result = await sdk.client.fetch(`/store/carts/${cartId}/flash-sales/claim`, { method: 'DELETE', headers: { ...(await getAuthHeaders()) }, cache: 'no-store' })
    const cartTag = await getCacheTag('carts')
    if (cartTag) revalidateTag(cartTag)
    return result
}
