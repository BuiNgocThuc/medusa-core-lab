import { ConditionalPromotionCatalogueItem } from '@lib/data/conditional-promotions'
import { HttpTypes } from '@medusajs/types'

type Props = {
    product: HttpTypes.StoreProduct
    promotions: ConditionalPromotionCatalogueItem[]
}

const ConditionalPromotionBanner = ({ product, promotions }: Props) => {
    const productData = product as HttpTypes.StoreProduct & {
        product_categories?: Array<{ id: string }>
    }
    const categoryIds = new Set((productData.product_categories ?? []).map((category) => category.id))
    const collectionId = productData.collection_id
    const relevant = promotions.filter((promotion) => {
        const placements = promotion.placements
        return (placements?.category_ids ?? []).some((id) => categoryIds.has(id)) ||
            Boolean(collectionId && placements?.collection_ids?.includes(collectionId))
    })

    if (!relevant.length) return null

    return <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900">
        {relevant.map((promotion) => <div key={promotion.id} className="mb-2 last:mb-0">
            <strong>{promotion.title}</strong>
            {promotion.description && <p>{promotion.description}</p>}
            {promotion.terms && <p className="text-xs text-green-700">{promotion.terms}</p>}
        </div>)}
    </div>
}

export default ConditionalPromotionBanner
