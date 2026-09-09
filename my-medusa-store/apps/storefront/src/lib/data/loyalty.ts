"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { revalidateTag } from "next/cache"
import {
  getAuthHeaders,
  getCacheOptions,
  getCacheTag,
  getCartId,
} from "./cookies"

export type LoyaltyProfile = {
  loyalty_points: number
  tier: "bronze" | "silver" | "gold"
}

export async function retrieveLoyaltyProfile(): Promise<LoyaltyProfile | null> {
  const authHeaders = await getAuthHeaders()

  if (!("authorization" in authHeaders)) {
    return null
  }

  return sdk.client
    .fetch<LoyaltyProfile>("/store/customers/me/loyalty-points", {
      method: "GET",
      headers: authHeaders,
      next: await getCacheOptions("loyalty"),
      cache: "force-cache",
    })
    .catch(() => null)
}

export async function redeemLoyaltyPoints(points = 100) {
  const cartId = await getCartId()

  if (!cartId) {
    throw new Error("No existing cart found")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.client
    .fetch(`/store/carts/${cartId}/loyalty-points`, {
      method: "POST",
      body: { points },
      headers,
    })
    .catch(medusaError)

  const [cartCacheTag, customerCacheTag, loyaltyCacheTag] = await Promise.all([
    getCacheTag("carts"),
    getCacheTag("customers"),
    getCacheTag("loyalty"),
  ])

  revalidateTag(cartCacheTag)
  revalidateTag(customerCacheTag)
  revalidateTag(loyaltyCacheTag)
}
