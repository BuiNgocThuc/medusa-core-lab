import { MedusaContainer } from "@medusajs/framework";
import { Modules, ProductStatus } from "@medusajs/framework/utils";
import { createProductsWorkflow } from "@medusajs/medusa/core-flows";
import { CATEGORY_NAMES, SUMMER_COLLECTION_HANDLE } from "./categories";
import { R2_IMAGES } from "../data";

// Mock image placeholder for products without real photos yet.
const mockImg = (handle: string) =>
    `https://placehold.co/800x800/png?text=${encodeURIComponent(handle)}`;

// Brand inferred from the handle prefix -> product metadata.brand.
const brandOf = (handle: string): string | null => {
    const h = handle.toLowerCase();
    if (h.startsWith("yonex-")) return "Yonex";
    if (h.startsWith("victor-")) return "Victor";
    if (h.startsWith("lining-")) return "Li-Ning";
    return null;
};

// Real product photos live in ../../data/product-images.generated.ts (cloned
// to Cloudflare R2 by src/scripts/clone-images-to-r2.ts). Missing products
// fall back to mockImg.
const imgOf = (handle: string) => ({
    thumbnail: R2_IMAGES[handle]?.thumbnail ?? mockImg(handle),
    images: (R2_IMAGES[handle]?.images ?? [mockImg(handle)]).map((url) => ({
        url,
    })),
});

type ProductSeed = {
    title: string;
    handle: string;
    category: (typeof CATEGORY_NAMES)[number];
    description: string;
    weight: number;
    variants: { title: string; sku: string; price: number }[];
    optionTitle: string;
};

// Single-variant helper (most accessories/rackets have one SKU).
function single(
    title: string,
    handle: string,
    sku: string,
    category: ProductSeed["category"],
    price: number,
    description: string,
    weight = 200,
): ProductSeed {
    return {
        title,
        handle,
        category,
        description,
        weight,
        optionTitle: "Default",
        variants: [{ title: "Default", sku, price }],
    };
}

// Sized helper (shoes come in multiple sizes -> multi-variant, no default).
function sized(
    title: string,
    handle: string,
    skuBase: string,
    category: ProductSeed["category"],
    price: number,
    description: string,
    sizes: string[],
    weight = 700,
): ProductSeed {
    return {
        title,
        handle,
        category,
        description,
        weight,
        optionTitle: "Size",
        variants: sizes.map((s) => ({
            title: s,
            sku: `${skuBase}-${s}`,
            price,
        })),
    };
}

export const PRODUCTS: ProductSeed[] = [
    // ── Vợt (Rackets) ──
    single(
        "Yonex Astrox 99 Pro",
        "yonex-astrox-99-pro",
        "RKT-AX99PRO",
        "Rackets",
        4_500_000,
        "Vợt tấn công đầu nặng, cây vợt tín nhiệm của Kento Momota.",
        90,
    ),
    single(
        "Li-Ning Axforce 80",
        "lining-axforce-80",
        "RKT-AXF80",
        "Rackets",
        3_200_000,
        "Vợt công thủ toàn diện, khung khí động học.",
        88,
    ),
    single(
        "Victor Thruster Ryuga II",
        "victor-thruster-ryuga-2",
        "RKT-TKRYUGA2",
        "Rackets",
        3_800_000,
        "Vợt tấn công tốc độ cao, đầu nặng vừa.",
        89,
    ),
    single(
        "Yonex Nanoflare 800",
        "yonex-nanoflare-800",
        "RKT-NF800",
        "Rackets",
        4_100_000,
        "Vợt phòng thủ - tốc độ, đầu nhẹ vụt nhanh.",
        83,
    ),

    // ── Dây cước (Strings) ──
    single(
        "Yonex BG65",
        "yonex-bg65",
        "STR-BG65",
        "Strings",
        120_000,
        "Dây cước bền phổ thông, phù hợp người mới.",
        20,
    ),
    single(
        "Yonex BG80 Power",
        "yonex-bg80-power",
        "STR-BG80P",
        "Strings",
        150_000,
        "Dây cước lực đánh mạnh, âm thanh giòn.",
        20,
    ),
    single(
        "Li-Ning No.1",
        "lining-no1-string",
        "STR-LNNO1",
        "Strings",
        130_000,
        "Dây cước cân bằng lực và độ bền.",
        20,
    ),

    // ── Quấn cán (Grips) ──
    single(
        "Yonex AC102 Towel Grip",
        "yonex-ac102-towel-grip",
        "GRP-AC102",
        "Grips",
        90_000,
        "Quấn cán khăn thấm mồ hôi tốt.",
        30,
    ),
    single(
        "Yonex Super Grap AC104",
        "yonex-super-grap-ac104",
        "GRP-AC104",
        "Grips",
        110_000,
        "Quấn cán mỏng bám tay, cuộn 3 cái.",
        30,
    ),
    single(
        "Victor GR262",
        "victor-gr262-grip",
        "GRP-GR262",
        "Grips",
        70_000,
        "Quấn cán cơ bản, giá tốt.",
        30,
    ),

    // ── Bao/Túi (Bags) ──
    single(
        "Yonex Pro Racket Bag 92026",
        "yonex-pro-bag-92026",
        "BAG-92026",
        "Bags",
        1_800_000,
        "Túi vợt cao cấp 6 ngăn, giữ nhiệt.",
        1500,
    ),
    single(
        "Victor BR9213",
        "victor-br9213-bag",
        "BAG-BR9213",
        "Bags",
        1_200_000,
        "Túi vợt 2 ngăn tiện dụng.",
        1300,
    ),

    // ── Giày (Shoes) — đa size ──
    sized(
        "Yonex Power Cushion 65Z3",
        "yonex-pc-65z3",
        "SHO-65Z3",
        "Shoes",
        2_200_000,
        "Giày cầu lông đế êm, chống trơn.",
        ["40", "41", "42", "43"],
    ),
    sized("Victor A970", "victor-a970", "SHO-A970", "Shoes", 1_900_000, "Giày ổn định, ôm chân.", [
        "40",
        "41",
        "42",
        "43",
    ]),
    sized(
        "Li-Ning Ranger",
        "lining-ranger",
        "SHO-RANGER",
        "Shoes",
        1_600_000,
        "Giày phổ thông nhẹ.",
        ["40", "41", "42"],
    ),

    // ── Tất (Socks) ──
    single(
        "Yonex Sport Socks 19120",
        "yonex-socks-19120",
        "SOC-19120",
        "Socks",
        120_000,
        "Tất thể thao dày, thấm hút.",
        50,
    ),
    single(
        "Victor SK155",
        "victor-sk155-socks",
        "SOC-SK155",
        "Socks",
        90_000,
        "Tất cổ ngắn thoáng khí.",
        50,
    ),

    // ── Lót giày (Insoles) ──
    single(
        "Yonex Power Cushion Insole",
        "yonex-pc-insole",
        "INS-PC01",
        "Insoles",
        350_000,
        "Lót giày giảm chấn Power Cushion.",
        80,
    ),

    // ── Cầu lông (Shuttlecocks) — 5 quả cầu đơn, mỗi loại có combo 3 ống tương ứng ──
    single(
        "Yonex Mavis 350",
        "yonex-mavis-350",
        "SHU-MAVIS350",
        "Shuttlecocks",
        350_000,
        "Cầu nhựa bền, tập luyện, 1 ống 6 quả.",
        120,
    ),
    single(
        "Yonex Aerosensa 30",
        "yonex-as30",
        "SHU-AS30",
        "Shuttlecocks",
        850_000,
        "Cầu lông vũ thi đấu, 1 ống 12 quả.",
        130,
    ),
    single(
        "Yonex Aerosensa 50",
        "yonex-as50",
        "SHU-AS50",
        "Shuttlecocks",
        980_000,
        "Cầu lông vũ thi đấu cao cấp, 1 ống 12 quả.",
        130,
    ),
    single(
        "Yonex Mavis 2000",
        "yonex-mavis-2000",
        "SHU-MAVIS2000",
        "Shuttlecocks",
        420_000,
        "Cầu nhựa cao cấp, độ bền cao, 1 ống 6 quả.",
        120,
    ),
    single(
        "Li-Ning A+62",
        "lining-a62",
        "SHU-LNA62",
        "Shuttlecocks",
        620_000,
        "Cầu lông vũ tập luyện - thi đấu, 1 ống 12 quả.",
        130,
    ),

    // ── Ống cầu (Tubes) — mỗi loại: bản 1 ống (single) + combo 3 ống (bulk) ──
    single(
        "Yonex Mavis 350 - 1 ống",
        "yonex-mavis-350-1tube",
        "TUB-MAVIS350X1",
        "Tubes",
        350_000,
        "1 ống cầu Mavis 350 (6 quả).",
        120,
    ),
    single(
        "Yonex Aerosensa 30 - 1 ống",
        "yonex-as30-1tube",
        "TUB-AS30X1",
        "Tubes",
        850_000,
        "1 ống cầu Aerosensa 30 (12 quả).",
        130,
    ),
    single(
        "Yonex Aerosensa 50 - 1 ống",
        "yonex-as50-1tube",
        "TUB-AS50X1",
        "Tubes",
        980_000,
        "1 ống cầu Aerosensa 50 (12 quả).",
        130,
    ),
    single(
        "Yonex Mavis 2000 - 1 ống",
        "yonex-mavis-2000-1tube",
        "TUB-MAVIS2000X1",
        "Tubes",
        420_000,
        "1 ống cầu Mavis 2000 (6 quả).",
        120,
    ),
    single(
        "Li-Ning A+62 - 1 ống",
        "lining-a62-1tube",
        "TUB-LNA62X1",
        "Tubes",
        620_000,
        "1 ống cầu Li-Ning A+62 (12 quả).",
        130,
    ),

    // combo 3 ống (bulk)
    single(
        "Yonex Mavis 350 - Combo 3 ống",
        "yonex-mavis-350-3tube",
        "TUB-MAVIS350X3",
        "Tubes",
        990_000,
        "Combo 3 ống cầu Mavis 350, giá tốt hơn/ống.",
        360,
    ),
    single(
        "Yonex Aerosensa 30 - Combo 3 ống",
        "yonex-as30-3tube",
        "TUB-AS30X3",
        "Tubes",
        2_400_000,
        "Combo 3 ống cầu Aerosensa 30, giá tốt hơn/ống.",
        380,
    ),
    single(
        "Yonex Aerosensa 50 - Combo 3 ống",
        "yonex-as50-3tube",
        "TUB-AS50X3",
        "Tubes",
        2_760_000,
        "Combo 3 ống cầu Aerosensa 50, giá tốt hơn/ống.",
        380,
    ),
    single(
        "Yonex Mavis 2000 - Combo 3 ống",
        "yonex-mavis-2000-3tube",
        "TUB-MAVIS2000X3",
        "Tubes",
        1_180_000,
        "Combo 3 ống cầu Mavis 2000, giá tốt hơn/ống.",
        360,
    ),
    single(
        "Li-Ning A+62 - Combo 3 ống",
        "lining-a62-3tube",
        "TUB-LNA62X3",
        "Tubes",
        1_740_000,
        "Combo 3 ống cầu Li-Ning A+62, giá tốt hơn/ống.",
        380,
    ),

    // ── Bổ sung ──
    single(
        "Yonex Astrox 88D Pro",
        "yonex-astrox-88d-pro",
        "RKT-AX88DPRO",
        "Rackets",
        4_300_000,
        "Vợt đôi công đầu nặng, kiểm soát tốt.",
        89,
    ),
    single(
        "Victor Auraspeed 90K",
        "victor-auraspeed-90k",
        "RKT-AS90K",
        "Rackets",
        3_600_000,
        "Vợt tốc độ khung mỏng, ra đòn nhanh.",
        86,
    ),
    single(
        "Yonex Aerobite",
        "yonex-aerobite",
        "STR-AEROBITE",
        "Strings",
        190_000,
        "Dây lai hybrid tăng độ xoáy.",
        20,
    ),
    single(
        "Victor VBS-63",
        "victor-vbs-63",
        "STR-VBS63",
        "Strings",
        140_000,
        "Dây cước êm, kiểm soát tốt.",
        20,
    ),
    single(
        "Yonex AC105 Grip",
        "yonex-ac105-grip",
        "GRP-AC105",
        "Grips",
        100_000,
        "Quấn cán bám, thấm hút.",
        30,
    ),
    single(
        "Victor BR9111 Bag",
        "victor-br9111-bag",
        "BAG-BR9111",
        "Bags",
        1_100_000,
        "Túi vợt Victor 2 ngăn.",
        1300,
    ),
];

export async function seedProducts(
    container: MedusaContainer,
    {
        categoryResult,
        shippingProfileId,
        salesChannelId,
    }: {
        categoryResult: { id: string; name: string }[];
        shippingProfileId: string;
        salesChannelId: string;
    },
) {
    const catId = (name: string) => categoryResult.find((c) => c.name === name)!.id;

    const productModule = container.resolve(Modules.PRODUCT) as any;
    const [existingSummerCollection] = await productModule.listProductCollections({
        handle: SUMMER_COLLECTION_HANDLE,
    });
    const summerCollection = existingSummerCollection ?? await productModule.createProductCollections({
        title: "SUMMER",
        handle: SUMMER_COLLECTION_HANDLE,
    });
    const summerHandles = new Set([
        "yonex-astrox-99-pro",
        "yonex-nanoflare-800",
        "yonex-astrox-88d-pro",
    ]);

    await createProductsWorkflow(container).run({
        input: {
            products: PRODUCTS.map((p) => ({
                title: p.title,
                handle: p.handle,
                description: p.description,
                weight: p.weight,
                status: ProductStatus.PUBLISHED,
                ...(brandOf(p.handle) ? { metadata: { brand: brandOf(p.handle) } } : {}),
                shipping_profile_id: shippingProfileId,
                thumbnail: imgOf(p.handle).thumbnail,
                images: imgOf(p.handle).images,
                category_ids: [catId(p.category)],
                ...(summerHandles.has(p.handle) && summerCollection
                    ? { collection_id: summerCollection.id }
                    : {}),
                options: [
                    {
                        title: p.optionTitle,
                        values: p.variants.map((v) => v.title),
                    },
                ],
                variants: p.variants.map((v) => ({
                    title: v.title,
                    sku: v.sku,
                    manage_inventory: true,
                    options: { [p.optionTitle]: v.title },
                    prices: [{ amount: v.price, currency_code: "vnd" }],
                })),
                sales_channels: [{ id: salesChannelId }],
            })),
        },
    });
}
