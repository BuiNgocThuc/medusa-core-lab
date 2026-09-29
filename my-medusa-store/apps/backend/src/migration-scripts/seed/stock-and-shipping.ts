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

    const { result: stockLocationResult } = await createStockLocationsWorkflow(container).run({
        input: {
            locations: [
                {
                    name: "Kho Củ Chi SOC (HCM Mega SOC)",
                    address: {
                        address_1: "WHC3+PH7, Đường N13, Củ Chi, Hồ Chí Minh",
                        city: "Củ Chi",
                        province: "Hồ Chí Minh",
                        postal_code: "71608",
                        country_code: "vn",
                        phone: "0901234567",
                        metadata: {
                            company: "Shopee Củ Chi SOC / Ralley Badminton Warehouse",
                            ghn: {
                                province_id: 1000001,
                                province_name: "Hồ Chí Minh",
                                ward_id: 1003493,
                                ward_name: "Xã Củ Chi",
                                is_new_address: true,
                                name_extension: [
                                    "xã củ chi",
                                    "x.củ chi",
                                    "x củ chi",
                                    "củ chi",
                                    "cu chi",
                                    "xa cu chi",
                                    "xacuchi",
                                    "cuchi",
                                ],
                            },
                            province_id: 1000001,
                            province_name: "Hồ Chí Minh",
                            ward_id: 1003493,
                            ward_name: "Xã Củ Chi",
                            v3_province_id: 1000001,
                            v3_ward_id: 1003493,
                            is_new_from_address: true,
                            is_new_address: true,
                        },
                    },
                    metadata: {
                        company: "Shopee Củ Chi SOC / Ralley Badminton Warehouse",
                        ghn: {
                            province_id: 1000001,
                            province_name: "Hồ Chí Minh",
                            ward_id: 1003493,
                            ward_name: "Xã Củ Chi",
                            is_new_address: true,
                            name_extension: [
                                "xã củ chi",
                                "x.củ chi",
                                "x củ chi",
                                "củ chi",
                                "cu chi",
                                "xa cu chi",
                                "xacuchi",
                                "cuchi",
                            ],
                        },
                        province_id: 1000001,
                        province_name: "Hồ Chí Minh",
                        ward_id: 1003493,
                        ward_name: "Xã Củ Chi",
                        v3_province_id: 1000001,
                        v3_ward_id: 1003493,
                        is_new_from_address: true,
                        is_new_address: true,
                    },
                },
            ],
        },
    });
    const stockLocation = stockLocationResult[0];

    // Link fulfillment providers: GHN và Manual cho stock location
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

    await link.create({
        [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
        [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
    });

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

    await linkSalesChannelsToStockLocationWorkflow(container).run({
        input: { id: stockLocation.id, add: [salesChannelId] },
    });

    return { stockLocation, shippingProfile };
}
