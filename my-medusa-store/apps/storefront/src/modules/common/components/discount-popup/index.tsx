'use client'

import { Button, Heading, Text } from '@medusajs/ui'
import Modal from '@modules/common/components/modal'
import useToggleState from '@lib/hooks/use-toggle-state'
import { useEffect } from 'react'
import LocalizedClientLink from '@modules/common/components/localized-client-link'

const DISCOUNT_POPUP_KEY = 'discount_popup_shown'

const DiscountPopup = () => {
    const { state, open, close } = useToggleState(false)

    useEffect(() => {
        // Check if the popup has been shown before
        const hasBeenShown = localStorage.getItem(DISCOUNT_POPUP_KEY)

        if (!hasBeenShown) {
            open()
            // Mark as shown
            localStorage.setItem(DISCOUNT_POPUP_KEY, 'true')
        }
    }, [open])

    return (
        <Modal
            isOpen={state}
            close={close}
            size="small"
            data-testid="discount-popup"
        >
            <div className="relative overflow-hidden bg-gradient-to-br from-amber-50 to-amber-100 rounded-t-lg px-6 pt-8 pb-6">
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-20 h-20 bg-amber-200 rounded-full -mr-10 -mt-10 opacity-50"></div>
                <div className="absolute bottom-0 left-0 w-16 h-16 bg-amber-200 rounded-full -ml-8 -mb-8 opacity-40"></div>

                <div className="relative">
                    {/* Sale tag */}
                    <div className="absolute -top-2 -right-2 bg-rose-500 text-white text-xs font-bold px-3 py-1 rounded-full transform rotate-12 shadow-md">
                        SAVE 10%
                    </div>

                    <Heading
                        level="h2"
                        className="text-2xl font-bold text-center text-amber-900"
                    >
                        Limited Time Offer!
                    </Heading>

                    <div className="flex justify-center my-4">
                        <div className="relative">
                            <div className="text-5xl font-bold text-rose-600">
                                10%
                            </div>
                            <div className="text-lg font-semibold text-amber-900 mt-1">
                                OFF YOUR FIRST ORDER
                            </div>
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-8xl text-amber-200 opacity-20 font-bold -z-10">
                                %
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <Modal.Body>
                <div className="flex flex-col items-center gap-y-6 py-6 px-6 bg-white">
                    <Text className="text-center text-gray-700">
                        Sign up now to receive an exclusive 10% discount on your
                        first purchase. Join our community of satisfied
                        customers!
                    </Text>

                    <div className="flex flex-col gap-y-4 w-full">
                        <LocalizedClientLink href="/account" className="w-full">
                            <Button
                                variant="primary"
                                className="w-full h-12 font-semibold text-base shadow-md hover:shadow-lg transition-all"
                                onClick={close}
                            >
                                Register & Save 10%
                            </Button>
                        </LocalizedClientLink>

                        <Button
                            variant="secondary"
                            className="w-full h-10 font-medium"
                            onClick={close}
                        >
                            Maybe Later
                        </Button>
                    </div>

                    <div className="text-xs text-gray-400 text-center mt-2">
                        *Discount applies to your first order only
                    </div>
                </div>
            </Modal.Body>
        </Modal>
    )
}

export default DiscountPopup
