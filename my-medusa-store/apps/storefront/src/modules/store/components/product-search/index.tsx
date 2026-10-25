'use client'

import { FormEvent, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type ProductSearchProps = {
    initialQuery?: string
}

export default function ProductSearch({
    initialQuery = '',
}: ProductSearchProps) {
    const [query, setQuery] = useState(initialQuery)
    const pathname = usePathname()
    const router = useRouter()
    const searchParams = useSearchParams()

    const submitSearch = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        const params = new URLSearchParams(searchParams.toString())
        const normalizedQuery = query.trim()

        if (normalizedQuery) {
            params.set('q', normalizedQuery)
        } else {
            params.delete('q')
        }

        params.delete('page')
        const queryString = params.toString()
        router.push(queryString ? `${pathname}?${queryString}` : pathname)
    }

    return (
        <form
            className="flex w-full max-w-xl gap-2"
            onSubmit={submitSearch}
            data-testid="product-search-form"
        >
            <label className="sr-only" htmlFor="product-search">
                Search products
            </label>
            <input
                id="product-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search products"
                className="w-full rounded-md border border-ui-border-base bg-ui-bg-base px-3 py-2 text-sm outline-none transition-colors focus:border-ui-fg-base"
                data-testid="product-search-input"
            />
            <button
                type="submit"
                className="rounded-md bg-gray-200 px-4 py-2 text-sm text-black hover:opacity-70 focus:outline-none"
                data-testid="product-search-submit"
            >
                Search
            </button>
        </form>
    )
}
