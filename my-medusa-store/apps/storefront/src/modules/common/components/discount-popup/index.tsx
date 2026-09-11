"use client"

import { Button, Heading, Text } from "@medusajs/ui"
import Modal from "@modules/common/components/modal"
import useToggleState from "@lib/hooks/use-toggle-state"
import { useEffect } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const DISCOUNT_POPUP_KEY = "discount_popup_shown"

const DiscountPopup = () => {
  const { state, open, close } = useToggleState(false)

  useEffect(() => {
    const hasBeenShown = localStorage.getItem(DISCOUNT_POPUP_KEY)
    if (!hasBeenShown) {
      open()
      localStorage.setItem(DISCOUNT_POPUP_KEY, "true")
    }
  }, [open])

  return (
    <Modal isOpen={state} close={close} size="small" data-testid="discount-popup">
      <div className="relative overflow-hidden rounded-t-lg bg-gradient-to-br from-amber-50 to-amber-100 px-6 pb-6 pt-8">
        <div className="absolute right-0 top-0 h-20 w-20 -mr-10 -mt-10 rounded-full bg-amber-200 opacity-50" />
        <div className="absolute bottom-0 left-0 h-16 w-16 -mb-8 -ml-8 rounded-full bg-amber-200 opacity-40" />
        <div className="relative">
          <div className="absolute -right-2 -top-2 rotate-12 rounded-full bg-rose-500 px-3 py-1 text-xs font-bold text-white shadow-md">SAVE 10%</div>
          <Heading level="h2" className="text-center text-2xl font-bold text-amber-900">Limited Time Offer!</Heading>
          <div className="my-4 flex justify-center"><div className="relative"><div className="text-5xl font-bold text-rose-600">10%</div><div className="mt-1 text-lg font-semibold text-amber-900">OFF YOUR FIRST ORDER</div></div></div>
        </div>
      </div>
      <Modal.Body>
        <div className="flex flex-col items-center gap-y-6 bg-white px-6 py-6">
          <Text className="text-center text-gray-700">Sign up now to receive an exclusive 10% discount on your first purchase. Join our community of satisfied customers!</Text>
          <div className="flex w-full flex-col gap-y-4">
            <LocalizedClientLink href="/account" className="w-full"><Button variant="primary" className="h-12 w-full font-semibold text-base shadow-md hover:shadow-lg transition-all" onClick={close}>Register & Save 10%</Button></LocalizedClientLink>
            <Button variant="secondary" className="h-10 w-full font-medium" onClick={close}>Maybe Later</Button>
          </div>
          <div className="mt-2 text-center text-xs text-gray-400">*Discount applies to your first order only</div>
        </div>
      </Modal.Body>
    </Modal>
  )
}

export default DiscountPopup
