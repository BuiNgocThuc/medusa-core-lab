'use server'

import { sdk } from '@lib/config'

export type ConditionalPromotionCatalogueItem = {
    id: string
    title: string
    description?: string | null
    terms?: string | null
    cta_url?: string | null
    placements?: { category_ids?: string[]; collection_ids?: string[] } | null
}

export async function listConditionalPromotions() {
    return sdk.client
        .fetch<{ promotions: ConditionalPromotionCatalogueItem[] }>(
            '/store/conditional-promotions',
            { method: 'GET', cache: 'no-store' }
        )
        .then((response) => response.promotions)
        .catch(() => [])
}
