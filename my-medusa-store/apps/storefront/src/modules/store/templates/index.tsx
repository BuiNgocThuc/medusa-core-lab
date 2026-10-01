import { Suspense } from 'react'

import { OptionValueIds } from '@lib/util/product-option-filters'
import SkeletonProductGrid from '@modules/skeletons/templates/skeleton-product-grid'
import RefinementList from '@modules/store/components/refinement-list'
import { SortOptions } from '@modules/store/components/refinement-list/sort-products'
import ProductSearch from '@modules/store/components/product-search'

import PaginatedProducts from './paginated-products'

const StoreTemplate = ({
    sortBy,
    page,
    countryCode,
    searchQuery,
    optionValueIds,
}: {
    sortBy?: SortOptions
    page?: string
    countryCode: string
    searchQuery?: string
    optionValueIds?: OptionValueIds
}) => {
    const pageNumber = page ? parseInt(page) : 1
    const sort = sortBy || 'created_at'

    return (
        <div
            className="flex flex-col small:flex-row small:items-start py-6 content-container"
            data-testid="category-container"
        >
            <RefinementList sortBy={sort} />
            <div className="w-full">
                <div className="mb-8 text-2xl-semi">
                    <h1 data-testid="store-page-title">All products</h1>
                </div>
                <div className="mb-8">
                    <ProductSearch initialQuery={searchQuery} />
                </div>
                <Suspense fallback={<SkeletonProductGrid />}>
                    <PaginatedProducts
                        sortBy={sort}
                        page={pageNumber}
                        countryCode={countryCode}
                        searchQuery={searchQuery}
                        optionValueIds={optionValueIds}
                    />
                </Suspense>
            </div>
        </div>
    )
}

export default StoreTemplate
