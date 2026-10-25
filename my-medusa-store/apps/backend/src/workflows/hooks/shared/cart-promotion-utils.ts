export function quantityForCategory(items: any[], category: string) {
    return items.reduce(
        (total, item) => total + (
            (item.variant?.product?.product_categories ?? []).some((entry: any) => entry.name === category)
                ? Number(item.quantity)
                : 0
        ),
        0,
    )
}

export function isVietnamCart(cart: any) {
    return cart.region?.name === "Vietnam" &&
        (!cart.shipping_address?.country_code || cart.shipping_address.country_code.toLowerCase() === "vn")
}

export function isFlashWindow(now = new Date()) {
    const hour = Number(new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit",
        hourCycle: "h23",
    }).format(now))
    return hour >= 18 && hour < 22
}
