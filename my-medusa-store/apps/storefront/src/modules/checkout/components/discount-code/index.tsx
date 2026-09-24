'use client'

import {
    Badge,
    Heading,
    Input,
    Label,
    Text,
} from '@modules/common/components/ui'
import React from 'react'

import { applyPromotions } from '@lib/data/cart'
import { convertToLocale } from '@lib/util/money'
import { HttpTypes } from '@medusajs/types'
import Trash from '@modules/common/icons/trash'
import { SubmitButton } from '../submit-button'
import { useToast } from '@modules/common/components/toast'

type DiscountCodeProps = {
    cart: HttpTypes.StoreCart
}

const DiscountCode: React.FC<DiscountCodeProps> = ({ cart }) => {
    const [isOpen, setIsOpen] = React.useState(false)
    const { showToast } = useToast()

    const { promotions = [] } = cart
    const isLoyaltyPromotion = (promotion: (typeof promotions)[number]) =>
        promotion.id === cart.metadata?.loyalty_promo_id
    const orderedPromotions = [...promotions].sort((left, right) => {
        if (isLoyaltyPromotion(left)) return 1
        if (isLoyaltyPromotion(right)) return -1
        if (left.is_automatic === right.is_automatic) return 0
        return left.is_automatic ? -1 : 1
    })
    const removePromotionCode = async (code: string) => {
        const validPromotions = promotions.filter(
            (promotion) => promotion.code !== code && !isLoyaltyPromotion(promotion)
        )

        await applyPromotions(
            validPromotions
                .filter((p) => p.code !== undefined)
                .map((p) => p.code!)
        )
    }

    const addPromotionCode = async (formData: FormData) => {

        const code = formData.get('code')
        if (!code) {
            return
        }
        const normalizedCode = code.toString().trim().toUpperCase()
        const alreadyApplied = promotions.some(
            (promotion) => promotion.code?.toUpperCase() === normalizedCode
        )

        if (alreadyApplied) {
            showToast({ content: 'Mã ưu đãi đã được áp dụng', type: 'warning' })
            return
        }
        const input = document.getElementById(
            'promotion-input'
        ) as HTMLInputElement
        const codes = promotions
            .filter((p) => p.code !== undefined && !isLoyaltyPromotion(p))
            .map((p) => p.code!)
        codes.push(normalizedCode)

        try {
            await applyPromotions(codes)
        } catch (e) {
            showToast({ content: e instanceof Error ? e.message : String(e), type: 'error' })
        }

        if (input) {
            input.value = ''
        }
    }

    return (
        <div className="w-full bg-white flex flex-col">
            <div className="txt-medium">
                <form
                    action={(a) => addPromotionCode(a)}
                    className="w-full mb-5"
                >
                    <Label className="flex gap-x-1 my-2 items-center">
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            type="button"
                            className="txt-medium text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
                            data-testid="add-discount-button"
                        >
                            Add Promotion Code(s)
                        </button>

                        {/* <Tooltip content="You can add multiple promotion codes">
              <InformationCircleSolid color="var(--fg-muted)" />
            </Tooltip> */}
                    </Label>

                    {isOpen && (
                        <>
                            <div className="flex w-full gap-x-2">
                                <Input
                                    className="size-full"
                                    id="promotion-input"
                                    name="code"
                                    type="text"
                                    autoFocus={false}
                                    data-testid="discount-input"
                                />
                                <SubmitButton
                                    variant="secondary"
                                    data-testid="discount-apply-button"
                                >
                                    Apply
                                </SubmitButton>
                            </div>

                        </>
                    )}
                </form>

                {promotions.length > 0 && (
                    <div className="w-full flex items-center">
                        <div className="flex flex-col w-full">
                            <Heading className="txt-medium mb-2">
                                Promotion(s) applied:
                            </Heading>

                            {orderedPromotions.map((promotion) => {
                                const isLoyalty = isLoyaltyPromotion(promotion)
                                const applicationMethod = promotion.application_method
                                const promotionValue = applicationMethod?.value
                                const promotionValueLabel =
                                    promotionValue === undefined
                                        ? null
                                        : applicationMethod?.type === 'percentage'
                                        ? `${promotionValue}%`
                                        : convertToLocale({
                                              amount: Number(promotionValue),
                                              currency_code:
                                                  applicationMethod?.currency_code ||
                                                  cart.currency_code,
                                          })

                                return (
                                    <div
                                        key={promotion.id}
                                        className="flex items-center justify-between w-full max-w-full mb-2"
                                        data-testid="discount-row"
                                    >
                                        <Text className="flex gap-x-1 items-baseline txt-small-plus w-4/5 pr-1">
                                            <span
                                                className="truncate"
                                                data-testid="discount-code"
                                            >
                                                <Badge
                                                    color={
                                                        isLoyalty ||
                                                        promotion.is_automatic
                                                            ? 'green'
                                                            : 'grey'
                                                    }
                                                >
                                                    {promotion.code}
                                                </Badge>{' '}
                                                {promotionValueLabel && (
                                                    <>({promotionValueLabel})</>
                                                )}
                                                {isLoyalty && (
                                                    <span className="ml-1 text-ui-fg-subtle">
                                                        Loyalty points
                                                    </span>
                                                )}
                                                {/* {promotion.is_automatic && (
                          <Tooltip content="This promotion is automatically applied">
                            <InformationCircleSolid className="inline text-zinc-400" />
                          </Tooltip>
                        )} */}
                                            </span>
                                        </Text>
                                        {!promotion.is_automatic &&
                                            !isLoyalty && (
                                            <button
                                                className="flex items-center"
                                                onClick={() => {
                                                    if (!promotion.code) {
                                                        return
                                                    }

                                                    removePromotionCode(
                                                        promotion.code
                                                    )
                                                }}
                                                data-testid="remove-discount-button"
                                            >
                                                <Trash size={14} />
                                                <span className="sr-only">
                                                    Remove discount code from
                                                    order
                                                </span>
                                            </button>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default DiscountCode
