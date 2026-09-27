'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
    fetchGhnProvinces,
    fetchGhnWards,
    GhnMatchResult,
    GhnProvinceV3,
    GhnWardV3,
    matchGhnEntities,
} from '@lib/data/ghn'

interface VietnamAddressSelectProps {
    initialProvince?: string
    initialWard?: string
    onProvinceSelect?: (province: GhnProvinceV3 | null) => void
    onWardSelect?: (ward: GhnWardV3 | null) => void
}

export default function VietnamAddressSelect({
    initialProvince = '',
    initialWard = '',
    onProvinceSelect,
    onWardSelect,
}: VietnamAddressSelectProps) {
    // Provinces State
    const [provinces, setProvinces] = useState<GhnProvinceV3[]>([])
    const [isLoadingProvinces, setIsLoadingProvinces] = useState(false)
    const [provinceQuery, setProvinceQuery] = useState(initialProvince)
    const [selectedProvince, setSelectedProvince] =
        useState<GhnProvinceV3 | null>(null)
    const [isProvinceOpen, setIsProvinceOpen] = useState(false)

    // Wards State
    const [wards, setWards] = useState<GhnWardV3[]>([])
    const [isLoadingWards, setIsLoadingWards] = useState(false)
    const [wardQuery, setWardQuery] = useState(initialWard)
    const [selectedWard, setSelectedWard] = useState<GhnWardV3 | null>(null)
    const [isWardOpen, setIsWardOpen] = useState(false)

    const provinceDropdownRef = useRef<HTMLDivElement>(null)
    const wardDropdownRef = useRef<HTMLDivElement>(null)

    // 1. Tải danh sách 34 Tỉnh/Thành phố v3 khi mount
    useEffect(() => {
        let isMounted = true
        setIsLoadingProvinces(true)

        fetchGhnProvinces()
            .then((data) => {
                if (!isMounted) return
                setProvinces(data)

                // Khôi phục giá trị đã lưu nếu có
                if (initialProvince) {
                    const matched = data.find(
                        (p) =>
                            p.name.toLowerCase() ===
                            initialProvince.toLowerCase()
                    )
                    if (matched) {
                        setSelectedProvince(matched)
                        setProvinceQuery(matched.name)
                    }
                }
            })
            .finally(() => {
                if (isMounted) setIsLoadingProvinces(false)
            })

        return () => {
            isMounted = false
        }
    }, [])

    // 2. Tải danh sách Phường/Xã khi Tỉnh/Thành thay đổi
    useEffect(() => {
        if (!selectedProvince) {
            setWards([])
            setSelectedWard(null)
            if (!initialWard) setWardQuery('')
            return
        }

        let isMounted = true
        setIsLoadingWards(true)

        fetchGhnWards(selectedProvince._id)
            .then((data) => {
                if (!isMounted) return
                setWards(data)

                if (initialWard) {
                    const matched = data.find(
                        (w) =>
                            w.name.toLowerCase() === initialWard.toLowerCase()
                    )
                    if (matched) {
                        setSelectedWard(matched)
                        setWardQuery(matched.name)
                    }
                }
            })
            .finally(() => {
                if (isMounted) setIsLoadingWards(false)
            })

        return () => {
            isMounted = false
        }
    }, [selectedProvince])

    // Xử lý click outside để đóng dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                provinceDropdownRef.current &&
                !provinceDropdownRef.current.contains(event.target as Node)
            ) {
                setIsProvinceOpen(false)
            }
            if (
                wardDropdownRef.current &&
                !wardDropdownRef.current.contains(event.target as Node)
            ) {
                setIsWardOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    // Lọc danh sách Tỉnh/Thành theo tên & extension_names
    const filteredProvinces: GhnMatchResult<GhnProvinceV3>[] = useMemo(() => {
        return matchGhnEntities(provinces, provinceQuery)
    }, [provinces, provinceQuery])

    // Lọc danh sách Phường/Xã theo tên & extension_names
    const filteredWards: GhnMatchResult<GhnWardV3>[] = useMemo(() => {
        return matchGhnEntities(wards, wardQuery)
    }, [wards, wardQuery])

    const handleSelectProvince = (province: GhnProvinceV3) => {
        setSelectedProvince(province)
        setProvinceQuery(province.name)
        setIsProvinceOpen(false)

        // Reset ward
        setSelectedWard(null)
        setWardQuery('')
        onProvinceSelect?.(province)
        onWardSelect?.(null)
    }

    const handleClearProvince = () => {
        setSelectedProvince(null)
        setProvinceQuery('')
        setSelectedWard(null)
        setWardQuery('')
        setWards([])
        setIsProvinceOpen(true)
        onProvinceSelect?.(null)
        onWardSelect?.(null)
    }

    const handleSelectWard = (ward: GhnWardV3) => {
        setSelectedWard(ward)
        setWardQuery(ward.name)
        setIsWardOpen(false)
        onWardSelect?.(ward)
    }

    const handleClearWard = () => {
        setSelectedWard(null)
        setWardQuery('')
        setIsWardOpen(true)
        onWardSelect?.(null)
    }

    return (
        <>
            {/* Các trường Hidden để submit qua Server Action setAddresses */}
            <input
                type="hidden"
                name="shipping_address.province"
                value={selectedProvince?.name || provinceQuery}
                required
            />
            <input
                type="hidden"
                name="shipping_address.city"
                value={selectedWard?.name || wardQuery}
                required
            />
            <input
                type="hidden"
                name="shipping_address.postal_code"
                value="700000"
            />
            <input
                type="hidden"
                name="shipping_address.metadata.ghn_province_id"
                value={selectedProvince?._id || ''}
            />
            <input
                type="hidden"
                name="shipping_address.metadata.ghn_province_name"
                value={selectedProvince?.name || ''}
            />
            <input
                type="hidden"
                name="shipping_address.metadata.ghn_ward_id"
                value={selectedWard?._id || ''}
            />
            <input
                type="hidden"
                name="shipping_address.metadata.ghn_ward_name"
                value={selectedWard?.name || ''}
            />

            {/* Ô 1: Chọn Tỉnh / Thành phố (34 Tỉnh/Thành GHN v3) */}
            <div className="relative flex flex-col" ref={provinceDropdownRef}>
                <label className="text-small-regular text-ui-fg-subtle mb-1">
                    Tỉnh / Thành phố (34 Tỉnh GHN v3){' '}
                    <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Gõ tìm kiếm (vd: hcm, hà nội, đà nẵng...)"
                        value={provinceQuery}
                        onChange={(e) => {
                            setProvinceQuery(e.target.value)
                            if (selectedProvince && selectedProvince.name !== e.target.value) {
                                setSelectedProvince(null)
                            }
                            setIsProvinceOpen(true)
                        }}
                        onFocus={() => setIsProvinceOpen(true)}
                        className="w-full bg-ui-bg-field border border-ui-border-base rounded-md px-4 py-2.5 text-small-regular text-ui-fg-base placeholder:text-ui-fg-muted focus:outline-none focus:border-ui-border-interactive focus:ring-1 focus:ring-ui-border-interactive pr-10"
                        autoComplete="off"
                        data-testid="ghn-province-input"
                    />

                    {/* Nút Clear hoặc Spinner */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-x-1">
                        {isLoadingProvinces ? (
                            <span className="w-4 h-4 border-2 border-ui-fg-muted border-t-transparent rounded-full animate-spin" />
                        ) : provinceQuery ? (
                            <button
                                type="button"
                                onClick={handleClearProvince}
                                className="text-ui-fg-muted hover:text-ui-fg-base text-xs p-1"
                                title="Xóa"
                            >
                                ✕
                            </button>
                        ) : (
                            <span className="text-ui-fg-muted text-xs pointer-events-none">
                                ▼
                            </span>
                        )}
                    </div>
                </div>

                {/* Dropdown Gợi ý Tỉnh / Thành phố */}
                {isProvinceOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-ui-border-base rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                        <div className="p-2 border-b border-ui-border-base bg-ui-bg-subtle text-xs text-ui-fg-muted flex justify-between items-center">
                            <span>
                                {filteredProvinces.length} Tỉnh/Thành phố khả dụng
                            </span>
                            {provinceQuery && (
                                <span className="italic">
                                    Tìm kiếm: &ldquo;{provinceQuery}&rdquo;
                                </span>
                            )}
                        </div>

                        {filteredProvinces.length === 0 ? (
                            <div className="p-4 text-center text-small-regular text-ui-fg-muted">
                                Không tìm thấy tỉnh thành phù hợp với &ldquo;
                                {provinceQuery}&rdquo;
                            </div>
                        ) : (
                            filteredProvinces.map(({ item, matchedAlias }) => {
                                const isSelected =
                                    selectedProvince?._id === item._id

                                return (
                                    <div
                                        key={item._id}
                                        onClick={() => handleSelectProvince(item)}
                                        className={`px-4 py-2.5 text-small-regular cursor-pointer flex items-center justify-between transition-colors ${
                                            isSelected
                                                ? 'bg-ui-bg-subtle-hover font-semibold text-ui-fg-interactive'
                                                : 'hover:bg-ui-bg-subtle text-ui-fg-base'
                                        }`}
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-medium text-ui-fg-base">
                                                {item.name}
                                            </span>
                                            {matchedAlias && (
                                                <span className="text-[11px] text-emerald-600 flex items-center gap-1 mt-0.5">
                                                    ✨ Khớp với:{' '}
                                                    <span className="font-semibold underline">
                                                        {matchedAlias}
                                                    </span>
                                                </span>
                                            )}
                                        </div>
                                        {isSelected && (
                                            <span className="text-emerald-600 text-xs">
                                                ✓ Đã chọn
                                            </span>
                                        )}
                                    </div>
                                )
                            })
                        )}
                    </div>
                )}
            </div>

            {/* Ô 2: Chọn Phường / Xã */}
            <div className="relative flex flex-col" ref={wardDropdownRef}>
                <label className="text-small-regular text-ui-fg-subtle mb-1">
                    Phường / Xã <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                    <input
                        type="text"
                        placeholder={
                            !selectedProvince
                                ? 'Vui lòng chọn Tỉnh/Thành trước'
                                : 'Gõ tìm kiếm (vd: bến nghé, vũng tàu, xã...)'
                        }
                        value={wardQuery}
                        disabled={!selectedProvince}
                        onChange={(e) => {
                            setWardQuery(e.target.value)
                            if (selectedWard && selectedWard.name !== e.target.value) {
                                setSelectedWard(null)
                            }
                            setIsWardOpen(true)
                        }}
                        onFocus={() => {
                            if (selectedProvince) setIsWardOpen(true)
                        }}
                        className={`w-full border rounded-md px-4 py-2.5 text-small-regular transition-all pr-10 ${
                            !selectedProvince
                                ? 'bg-ui-bg-disabled border-ui-border-base cursor-not-allowed text-ui-fg-muted'
                                : 'bg-ui-bg-field border-ui-border-base text-ui-fg-base placeholder:text-ui-fg-muted focus:outline-none focus:border-ui-border-interactive focus:ring-1 focus:ring-ui-border-interactive'
                        }`}
                        autoComplete="off"
                        data-testid="ghn-ward-input"
                    />

                    {/* Nút Clear hoặc Spinner */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-x-1">
                        {isLoadingWards ? (
                            <span className="w-4 h-4 border-2 border-ui-fg-muted border-t-transparent rounded-full animate-spin" />
                        ) : wardQuery && selectedProvince ? (
                            <button
                                type="button"
                                onClick={handleClearWard}
                                className="text-ui-fg-muted hover:text-ui-fg-base text-xs p-1"
                                title="Xóa"
                            >
                                ✕
                            </button>
                        ) : selectedProvince ? (
                            <span className="text-ui-fg-muted text-xs pointer-events-none">
                                ▼
                            </span>
                        ) : null}
                    </div>
                </div>

                {/* Dropdown Gợi ý Phường / Xã */}
                {isWardOpen && selectedProvince && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-ui-border-base rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                        <div className="p-2 border-b border-ui-border-base bg-ui-bg-subtle text-xs text-ui-fg-muted flex justify-between items-center">
                            <span>
                                {filteredWards.length} Phường/Xã tại {selectedProvince.name}
                            </span>
                            {wardQuery && (
                                <span className="italic">
                                    Tìm kiếm: &ldquo;{wardQuery}&rdquo;
                                </span>
                            )}
                        </div>

                        {filteredWards.length === 0 ? (
                            <div className="p-4 text-center text-small-regular text-ui-fg-muted">
                                {isLoadingWards
                                    ? 'Đang tải danh sách...'
                                    : `Không tìm thấy phường/xã phù hợp với "${wardQuery}"`}
                            </div>
                        ) : (
                            filteredWards.map(({ item, matchedAlias }) => {
                                const isSelected = selectedWard?._id === item._id

                                return (
                                    <div
                                        key={item._id}
                                        onClick={() => handleSelectWard(item)}
                                        className={`px-4 py-2.5 text-small-regular cursor-pointer flex items-center justify-between transition-colors ${
                                            isSelected
                                                ? 'bg-ui-bg-subtle-hover font-semibold text-ui-fg-interactive'
                                                : 'hover:bg-ui-bg-subtle text-ui-fg-base'
                                        }`}
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-medium text-ui-fg-base">
                                                {item.name}
                                            </span>
                                            {matchedAlias && (
                                                <span className="text-[11px] text-emerald-600 flex items-center gap-1 mt-0.5">
                                                    ✨ Khớp với:{' '}
                                                    <span className="font-semibold underline">
                                                        {matchedAlias}
                                                    </span>
                                                </span>
                                            )}
                                        </div>
                                        {isSelected && (
                                            <span className="text-emerald-600 text-xs">
                                                ✓ Đã chọn
                                            </span>
                                        )}
                                    </div>
                                )
                            })
                        )}
                    </div>
                )}
            </div>
        </>
    )
}
