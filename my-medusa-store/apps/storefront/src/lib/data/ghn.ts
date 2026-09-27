import { sdk } from '@lib/config'

export interface GhnProvinceV3 {
    _id: number
    name: string
    extension_names: string[]
    type: string
    parent_id: number
    status: number
}

export interface GhnWardV3 {
    _id: number
    name: string
    extension_names: string[]
    type: string
    parent_id: number
    status: number
}

export interface GhnMatchResult<T> {
    item: T
    matchedAlias?: string
}

/**
 * Loại bỏ dấu tiếng Việt để so khớp linh hoạt
 */
export function removeVietnameseTones(str: string): string {
    return (str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim()
}

/**
 * Thuật toán tìm kiếm thông minh dựa trên Tên và mảng extension_names của GHN.
 * Khi user gõ: "hcm", "tp.hcm", "ho chi minh", "ha noi", "vung tau"...
 * sẽ tự động tìm kiếm trong name và toàn bộ biến thể extension_names.
 */
export function matchGhnEntities<
    T extends { name: string; extension_names?: string[] }
>(items: T[], query: string): GhnMatchResult<T>[] {
    if (!query || !query.trim()) {
        return items.map((item) => ({ item }))
    }

    const qLower = query.toLowerCase().trim()
    const qNoTone = removeVietnameseTones(query)

    const results: GhnMatchResult<T>[] = []

    for (const item of items) {
        const nameLower = item.name.toLowerCase()
        const nameNoTone = removeVietnameseTones(item.name)

        // 1. Kiểm tra khớp tên chính thức
        if (nameLower.includes(qLower) || nameNoTone.includes(qNoTone)) {
            results.push({ item })
            continue
        }

        // 2. Kiểm tra khớp trong extension_names (các biến thể viết tắt, không dấu, có tiền tố)
        const matchedExt = item.extension_names?.find((ext) => {
            const extLower = ext.toLowerCase()
            const extNoTone = removeVietnameseTones(ext)

            return (
                extLower.includes(qLower) ||
                extNoTone.includes(qNoTone) ||
                qNoTone.includes(extNoTone)
            )
        })

        if (matchedExt) {
            results.push({
                item,
                matchedAlias: matchedExt,
            })
        }
    }

    return results
}

// Client-side in-memory cache giúp giao diện phản hồi 0ms khi chuyển đổi
let clientProvincesCache: GhnProvinceV3[] | null = null
const clientWardsCache = new Map<number, GhnWardV3[]>()

/**
 * Lấy danh sách 34 Tỉnh/Thành phố mới nhất từ GHN v3 API qua Medusa Backend
 * (Hỗ trợ 2 tầng cache: Client-side In-memory và Backend Redis TTL 24h)
 */
export async function fetchGhnProvinces(): Promise<GhnProvinceV3[]> {
    if (clientProvincesCache && clientProvincesCache.length > 0) {
        return clientProvincesCache
    }

    try {
        const response = await sdk.client.fetch<{
            code: number
            message: string
            data: GhnProvinceV3[]
        }>('/store/ghn/provinces')

        const data = response?.data || []
        if (data.length > 0) {
            clientProvincesCache = data
        }
        return data
    } catch (error) {
        console.error('[GHN Storefront] Error fetching provinces:', error)
        return []
    }
}

/**
 * Lấy danh sách Phường/Xã mới nhất từ GHN v3 API theo Province ID
 * (Hỗ trợ 2 tầng cache: Client-side In-memory Map và Backend Redis TTL 24h)
 */
export async function fetchGhnWards(
    provinceId: number
): Promise<GhnWardV3[]> {
    if (!provinceId) return []

    if (clientWardsCache.has(provinceId)) {
        return clientWardsCache.get(provinceId)!
    }

    try {
        const response = await sdk.client.fetch<{
            code: number
            message: string
            data: GhnWardV3[]
        }>('/store/ghn/wards', {
            query: {
                province_id: provinceId,
            },
        })

        const data = response?.data || []
        if (data.length > 0) {
            clientWardsCache.set(provinceId, data)
        }
        return data
    } catch (error) {
        console.error(
            `[GHN Storefront] Error fetching wards for province ${provinceId}:`,
            error
        )
        return []
    }
}
