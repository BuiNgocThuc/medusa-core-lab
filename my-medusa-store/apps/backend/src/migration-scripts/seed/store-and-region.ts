import { MedusaContainer } from "@medusajs/framework";
import {
    createApiKeysWorkflow,
    createRegionsWorkflow,
    createSalesChannelsWorkflow,
    createStoresWorkflow,
    createTaxRegionsWorkflow,
    linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/medusa/core-flows";

export const COUNTRIES = ["vn"];

export async function seedStoreAndRegion(container: MedusaContainer) {
    const {
        result: [defaultSalesChannel],
    } = await createSalesChannelsWorkflow(container).run({
        input: {
            salesChannelsData: [
                {
                    name: "Default Sales Channel",
                    description: "Ralley Badminton",
                },
            ],
        },
    });

    const {
        result: [publishableApiKey],
    } = await createApiKeysWorkflow(container).run({
        input: {
            api_keys: [
                {
                    title: "Default Publishable API Key",
                    type: "publishable",
                    created_by: "",
                },
            ],
        },
    });
    await linkSalesChannelsToApiKeyWorkflow(container).run({
        input: { id: publishableApiKey.id, add: [defaultSalesChannel.id] },
    });

    await createStoresWorkflow(container).run({
        input: {
            stores: [
                {
                    name: "Ralley Badminton Store",
                    supported_currencies: [
                        { currency_code: "vnd", is_default: true },
                    ],
                    default_sales_channel_id: defaultSalesChannel.id,
                },
            ],
        },
    });

    const { result: regionResult } = await createRegionsWorkflow(container).run({
        input: {
            regions: [
                {
                    name: "Vietnam",
                    currency_code: "vnd",
                    countries: COUNTRIES,
                    payment_providers: [
                        "pp_system_default",
                        "pp_bank-transfer_default",
                    ],
                },
            ],
        },
    });
    const region = regionResult[0];

    await createTaxRegionsWorkflow(container).run({
        input: COUNTRIES.map((country_code) => ({
            country_code,
            provider_id: "tp_system",
        })),
    });

    return { defaultSalesChannel, publishableApiKey, region };
}
