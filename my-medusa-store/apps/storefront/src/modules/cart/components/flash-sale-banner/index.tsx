'use client'

import { ActiveFlashSale } from '@lib/data/flash-sales'
import { Button, Heading, Text } from '@modules/common/components/ui'
import Modal from '@modules/common/components/modal'
import { useToast } from '@modules/common/components/toast'
import React from 'react'

const FlashSaleBanner = ({ flashSales }: { flashSales: ActiveFlashSale[] }) => {
    const { showToast } = useToast()
    const sale = flashSales[0]
    const storageKey = sale ? `flash-sale-minimized-${sale.code}` : ''
    const [isOpen, setIsOpen] = React.useState(false)
    const [isReady, setIsReady] = React.useState(false)

    React.useEffect(() => {
        if (!sale) return
        setIsOpen(localStorage.getItem(storageKey) !== 'true')
        setIsReady(true)
    }, [sale?.code, storageKey])

    if (!sale || !isReady) return null

    const close = () => { localStorage.setItem(storageKey, 'true'); setIsOpen(false) }
    const open = () => { localStorage.removeItem(storageKey); setIsOpen(true) }
    const copy = async () => { await navigator.clipboard?.writeText(sale.code); showToast({ content: `Copied ${sale.code}`, type: 'success' }) }

    return <>
        <Modal isOpen={isOpen} close={close} size="small" data-testid="flash-sale-modal">
            <div className="relative overflow-hidden rounded-t-lg bg-gradient-to-br from-orange-50 via-amber-50 to-rose-100 px-6 pb-7 pt-8">
                <div className="absolute -right-10 -top-10 size-32 rounded-full bg-orange-200/60" />
                <div className="absolute -bottom-12 -left-10 size-32 rounded-full bg-rose-200/60" />
                <button type="button" aria-label="Close Flash Sale" onClick={close} className="absolute right-4 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-white/80 text-xl text-ui-fg-subtle shadow-sm hover:bg-white">×</button>
                <div className="relative text-center"><Text className="text-xs font-bold uppercase tracking-[0.2em] text-orange-700">Limited Flash Sale</Text><Heading level="h2" className="mt-3 text-4xl font-bold text-rose-600">{sale.percentage}% OFF</Heading><Text className="mt-2 text-lg font-semibold text-orange-950">Up to {sale.max_discount_amount.toLocaleString('vi-VN')} VND</Text></div>
            </div>
            <Modal.Body><div className="flex flex-col items-center gap-y-5 bg-white px-6 py-7 text-center"><Text className="text-ui-fg-subtle">Copy this voucher and use it in your cart before {new Date(sale.ends_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}.</Text><div className="w-full rounded-md border border-dashed border-orange-300 bg-orange-50 px-4 py-3 font-mono text-lg font-bold tracking-wider text-orange-800">{sale.code}</div><Button type="button" className="h-11 w-full" onClick={copy}>Copy code</Button></div></Modal.Body>
        </Modal>
        {!isOpen && <button type="button" aria-label="Open Flash Sale" onClick={open} className="fixed left-0 top-1/2 z-50 flex size-12 -translate-y-1/2 items-center justify-center rounded-r-full bg-rose-600 text-white shadow-lg transition hover:bg-rose-700" data-testid="flash-sale-launcher"><svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 fill-none stroke-current stroke-2"><path d="M4 9h16v10H4z" /><path d="M12 9v10M4 13h16M9 9c-1.5 0-2.5-.8-2.5-2s1-2 2.5-2c1.2 0 2.4 1 3 4M15 9c1.5 0 2.5-.8 2.5-2S16.5 5 15 5c-1.2 0-2.4 1-3 4" /></svg></button>}
    </>
}

export default FlashSaleBanner
