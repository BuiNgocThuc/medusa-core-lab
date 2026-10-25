import { listConditionalPromotions } from '@lib/data/conditional-promotions'
import Link from 'next/link'

export default async function PromotionsPage() {
    const promotions = await listConditionalPromotions()
    return <main className="content-container py-12"><h1 className="text-2xl font-semibold mb-6">Promotions</h1><div className="grid gap-4 small:grid-cols-2">{promotions.map((promotion) => <article className="rounded-lg border p-5" key={promotion.id}><h2 className="font-semibold">{promotion.title}</h2>{promotion.description && <p className="mt-2 text-sm">{promotion.description}</p>}{promotion.terms && <p className="mt-2 text-xs text-ui-fg-subtle">{promotion.terms}</p>}{promotion.cta_url && <Link className="mt-4 inline-block text-ui-fg-interactive" href={promotion.cta_url}>Explore products</Link>}</article>)}</div>{!promotions.length && <p>No promotions are available right now.</p>}</main>
}
