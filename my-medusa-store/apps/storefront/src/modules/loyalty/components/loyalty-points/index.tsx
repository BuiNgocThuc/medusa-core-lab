"use client"

import { redeemLoyaltyPoints, type LoyaltyProfile } from "@lib/data/loyalty"
import { Button, Heading, Text } from "@modules/common/components/ui"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

type LoyaltyPointsProps = {
  profile: LoyaltyProfile | null
}

const LoyaltyPoints = ({ profile }: LoyaltyPointsProps) => {
  const router = useRouter()
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()
  const canRedeem = profile !== null && profile.loyalty_points >= 100

  const redeem = () => {
    setError("")
    startTransition(async () => {
      try {
        await redeemLoyaltyPoints()
        router.refresh()
      } catch (error) {
        setError(error instanceof Error ? error.message : String(error))
      }
    })
  }

  return (
    <div className="flex flex-col gap-y-3" data-testid="loyalty-points">
      <div className="flex items-baseline justify-between gap-x-4">
        <Heading level="h3" className="text-large-semi">
          Loyalty points
        </Heading>
        <Text className="text-small-regular text-ui-fg-subtle">
          {profile ? `${profile.loyalty_points} points available` : "Unavailable"}
        </Text>
      </div>
      {!profile && (
        <Text className="text-small-regular text-ui-fg-subtle">
          Sign in to view and redeem loyalty points.
        </Text>
      )}
      <Button
        type="button"
        variant="secondary"
        onClick={redeem}
        disabled={!canRedeem || isPending}
        isLoading={isPending}
        className="w-full"
        data-testid="redeem-loyalty-points-button"
      >
        Redeem 100 points for 10.000đ
      </Button>
      {error && (
        <Text className="text-small-regular text-rose-500" data-testid="loyalty-error-message">
          {error}
        </Text>
      )}
    </div>
  )
}

export default LoyaltyPoints
