import { MedusaContainer } from "@medusajs/framework";
import {
    ContainerRegistrationKeys,
    ModuleRegistrationName,
    Modules,
} from "@medusajs/framework/utils";
import {
    createShippingOptionsWorkflow,
    createStockLocationsWorkflow,
    linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows";

// Flat-rate shipping only. Free-shipping threshold rules are deferred pending
// SRS clarification (see plan note) — no threshold constant lives here yet.
export async function seedStockAndShipping(
    container: MedusaContainer,
    { regionId, salesChannelId }: { regionId: string; salesChannelId: string },
) {
    const link = container.resolve(ContainerRegistrationKeys.LINK);
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const fulfillmentModuleService = container.resolve(ModuleRegistrationName.FULFILLMENT);

    // Cấu hình Kho Trung Tâm (Central Warehouse - Ralley Badminton Store)
    const centralWarehouseMeta = {
        company: "Ralley Badminton Store",
        ghn: {
            province_id: 1000001,
            province_name: "Hồ Chí Minh",
            ward_id: 1003573,
            ward_name: "Phường Hiệp Bình",
            district_id: 3695,
            district_name: "Thành Phố Thủ Đức",
            ward_code: "90741",
            is_new_address: true,
            name_extension: [
                "phường hiệp bình",
                "p.hiệp bình",
                "p hiệp bình",
                "hiệp bình",
                "hiep binh",
                "phuong hiep binh",
                "phuonghiepbinh",
                "hiepbinh",
            ],
        },
        province_id: 1000001,
        province_name: "Hồ Chí Minh",
        ward_id: 1003573,
        ward_name: "Phường Hiệp Bình",
        district_id: 3695,
        district_name: "Thành Phố Thủ Đức",
        ward_code: "90741",
        ghn_district_id: 3695,
        ghn_ward_code: "90741",
        v3_province_id: 1000001,
        v3_ward_id: 1003573,
        is_new_from_address: true,
        is_new_address: true,
    };

    // 1. Tạo 1 Stock Location duy nhất đại diện cho toàn bộ shop
    const { result: stockLocationResult } = await createStockLocationsWorkflow(container).run({
        input: {
            locations: [
                {
                    name: "Central Warehouse",
                    address: {
                        address_1: "123 Đường Hiệp Bình, Phường Hiệp Bình, TP. Thủ Đức, TP. Hồ Chí Minh",
                        city: "Hồ Chí Minh",
                        province: "Hồ Chí Minh",
                        postal_code: "700000",
                        country_code: "vn",
                        phone: "0901234567",
                        metadata: centralWarehouseMeta,
                    },
                    metadata: centralWarehouseMeta,
                },
            ],
        },
    });
    const stockLocation = stockLocationResult[0];

    // 2. Link fulfillment providers: GHN và Manual cho Stock Location
    await link.create([
        {
            [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
            [Modules.FULFILLMENT]: { fulfillment_provider_id: "ghn_ghn" },
        },
        {
            [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
            [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
        },
    ]);

    const { data: shippingProfileResult } = await query.graph({
        entity: "shipping_profile",
        fields: ["id"],
    });
    const shippingProfile = shippingProfileResult[0];

    // 3. Tạo 1 Fulfillment Set duy nhất (loại shipping) phủ sóng toàn quốc
    const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
        name: "Vietnam delivery",
        type: "shipping",
        service_zones: [
            {
                name: "Vietnam",
                geo_zones: [{ country_code: "vn", type: "country" }],
            },
        ],
    });

    // 4. Link 1-1 giữa Stock Location và Fulfillment Set (tuân thủ chặt chẽ Issue #16115)
    await link.create({
        [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
        [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
    });

    // 5. Tạo bộ 3 Shipping Options tiêu chuẩn cho Storefront
    await createShippingOptionsWorkflow(container).run({
        input: [
            {
                name: "Giao Hàng Nhanh Shipping",
                price_type: "calculated",
                provider_id: "ghn_ghn",
                service_zone_id: fulfillmentSet.service_zones[0].id,
                shipping_profile_id: shippingProfile.id,
                type: {
                    label: "Giao Hàng Nhanh",
                    description: "Giao hàng qua GHN (tính cước thời gian thực).",
                    code: "giao-hang-nhanh-type",
                },
                data: {
                    id: "ghn-delivery",
                    name: "GHN Delivery",
                },
                rules: [
                    {
                        attribute: "enabled_in_store",
                        value: "true",
                        operator: "eq",
                    },
                    { attribute: "is_return", value: "false", operator: "eq" },
                ],
            },
            {
                name: "Standard Shipping",
                price_type: "flat",
                provider_id: "manual_manual",
                service_zone_id: fulfillmentSet.service_zones[0].id,
                shipping_profile_id: shippingProfile.id,
                type: {
                    label: "Standard",
                    description: "Giao 2-3 ngày.",
                    code: "standard",
                },
                prices: [
                    { currency_code: "vnd", amount: 30_000 },
                    { region_id: regionId, amount: 30_000 },
                ],
                rules: [
                    {
                        attribute: "enabled_in_store",
                        value: "true",
                        operator: "eq",
                    },
                    { attribute: "is_return", value: "false", operator: "eq" },
                ],
            },
            {
                name: "Express Shipping",
                price_type: "flat",
                provider_id: "manual_manual",
                service_zone_id: fulfillmentSet.service_zones[0].id,
                shipping_profile_id: shippingProfile.id,
                type: {
                    label: "Express",
                    description: "Giao trong 24h.",
                    code: "express",
                },
                prices: [
                    { currency_code: "vnd", amount: 60_000 },
                    { region_id: regionId, amount: 60_000 },
                ],
                rules: [
                    {
                        attribute: "enabled_in_store",
                        value: "true",
                        operator: "eq",
                    },
                    { attribute: "is_return", value: "false", operator: "eq" },
                ],
            },
        ],
    });

    // 6. Link Stock Location vào Sales Channel
    await linkSalesChannelsToStockLocationWorkflow(container).run({
        input: { id: stockLocation.id, add: [salesChannelId] },
    });

    return { stockLocation, stockLocations: [stockLocation], shippingProfile };
}
