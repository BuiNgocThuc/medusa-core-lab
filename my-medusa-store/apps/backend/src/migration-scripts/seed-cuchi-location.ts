import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  Modules,
} from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Script thiết lập kho Shopee Củ Chi SOC (HCM Mega SOC):
 * - Tên: Kho Củ Chi SOC (HCM Mega SOC)
 * - Địa chỉ: Đường N13, KCN Tân Phú Trung, Quốc Lộ 22, Ấp Trạm Bơm, Xã Tân Phú Trung, Huyện Củ Chi, TP. Hồ Chí Minh
 * - GHN Master Data: district_id: 1460, ward_code: "22114" (Xã Tân Phú Trung)
 *
 * Thực thi:
 *   pnpm --filter @dtc/backend exec medusa exec ./src/migration-scripts/seed-cuchi-location.ts
 */
export default async function seedCuChiLocation({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const stockLocationModule = container.resolve(Modules.STOCK_LOCATION)
  const fulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT
  )
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL)

  logger.info("[seed-cuchi] Bắt đầu thiết lập Kho Củ Chi SOC...")

  const cuChiMetadata = {
    company: "Shopee Củ Chi SOC / Ralley Badminton Warehouse",
    ghn: {
      district_id: 1460,
      ward_code: "22114",
      ward_name: "Xã Tân Phú Trung",
      district_name: "Huyện Củ Chi",
      province_name: "Hồ Chí Minh",
      name_extension: [
        "Xã Tân Phú Trung",
        "X.Tân Phú Trung",
        "X Tân Phú Trung",
        "Tân Phú Trung",
        "Tan Phu Trung",
        "Xa Tan Phu Trung",
        "tanphutrung",
      ],
    },
    ghn_district_id: 1460,
    ghn_ward_code: "22114",
    district_id: 1460,
    ward_code: "22114",
  }

  const cuChiAddress = {
    address_1: "Đường N13, KCN Tân Phú Trung, Quốc Lộ 22, Ấp Trạm Bơm",
    address_2: "Đối diện Bệnh viện Đa khoa Xuyên Á",
    city: "Xã Tân Phú Trung, Huyện Củ Chi",
    province: "Hồ Chí Minh",
    postal_code: "71608",
    country_code: "vn",
    phone: "0901234567",
    metadata: cuChiMetadata,
  }

  // 1. Kiểm tra kho Củ Chi đã tồn tại chưa
  const existingLocations = await stockLocationModule.listStockLocations({
    name: "Kho Củ Chi SOC (HCM Mega SOC)",
  })

  let stockLocation: any

  if (existingLocations.length > 0) {
    stockLocation = existingLocations[0]
    logger.info(`[seed-cuchi] Đã có sẵn Kho Củ Chi SOC (${stockLocation.id}). Cập nhật thông tin...`)
    await stockLocationModule.updateStockLocations(stockLocation.id, {
      name: "Kho Củ Chi SOC (HCM Mega SOC)",
      metadata: cuChiMetadata,
    })
    if (stockLocation.address_id) {
      await stockLocationModule.upsertStockLocationAddresses([
        {
          id: stockLocation.address_id,
          ...cuChiAddress,
        },
      ])
    }
  } else {
    logger.info("[seed-cuchi] Tạo mới Kho Củ Chi SOC (HCM Mega SOC)...")
    const { result: createdLocations } = await createStockLocationsWorkflow(
      container
    ).run({
      input: {
        locations: [
          {
            name: "Kho Củ Chi SOC (HCM Mega SOC)",
            address: cuChiAddress,
            metadata: cuChiMetadata,
          },
        ],
      },
    })
    stockLocation = createdLocations[0]
  }

  // 2. Liên kết Kho Củ Chi với Provider ghn_ghn và manual_manual
  logger.info("[seed-cuchi] Liên kết Kho Củ Chi với Provider ghn_ghn và manual_manual...")
  try {
    await link.create([
      {
        [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
        [Modules.FULFILLMENT]: { fulfillment_provider_id: "ghn_ghn" },
      },
      {
        [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
        [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
      },
    ])
  } catch (err: any) {
    // Đã link
  }

  // 3. Liên kết Sales Channel với Kho Củ Chi
  const salesChannels = await salesChannelModule.listSalesChannels({
    name: "Default Sales Channel",
  })
  if (salesChannels.length > 0) {
    try {
      await linkSalesChannelsToStockLocationWorkflow(container).run({
        input: { id: stockLocation.id, add: [salesChannels[0].id] },
      })
    } catch (err: any) {
      // Đã link
    }
  }

  // 4. Lấy hoặc tạo Fulfillment Set & Service Zone "Vietnam"
  const fulfillmentSets = await fulfillmentModuleService.listFulfillmentSets(
    { name: "Vietnam delivery" },
    { relations: ["service_zones", "service_zones.geo_zones"] }
  )

  let fulfillmentSet: any = fulfillmentSets[0]

  if (!fulfillmentSet) {
    logger.info("[seed-cuchi] Tạo Fulfillment Set 'Vietnam delivery'...")
    fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
      name: "Vietnam delivery",
      type: "shipping",
      service_zones: [
        {
          name: "Vietnam",
          geo_zones: [{ country_code: "vn", type: "country" }],
        },
      ],
    })
  }

  // Liên kết Stock Location với Fulfillment Set
  try {
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
    })
  } catch (err: any) {
    // Đã link
  }

  // 5. Cấp inventory level (1000 quantity) cho kho Củ Chi nếu chưa có
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "location_levels.*"],
  })

  const levelsToCreate = inventoryItems
    .filter(
      (item: any) =>
        !item.location_levels?.some(
          (lvl: any) => lvl.location_id === stockLocation.id
        )
    )
    .map((item: any) => ({
      location_id: stockLocation.id,
      stocked_quantity: 1000,
      inventory_item_id: item.id,
    }))

  if (levelsToCreate.length > 0) {
    logger.info(`[seed-cuchi] Khởi tạo tồn kho (${levelsToCreate.length} sản phẩm) cho Kho Củ Chi SOC...`)
    try {
      await createInventoryLevelsWorkflow(container).run({
        input: {
          inventory_levels: levelsToCreate,
        },
      })
    } catch (err: any) {
      logger.warn(`[seed-cuchi] Khởi tạo inventory: ${err?.message}`)
    }
  }

  // 6. Shipping Profile & Shipping Option "Giao Hàng Nhanh Shipping"
  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  })
  const shippingProfileId = shippingProfiles[0]?.id
  const serviceZone = fulfillmentSet.service_zones?.[0]

  if (shippingProfileId && serviceZone) {
    const existingOptions = await fulfillmentModuleService.listShippingOptions({
      name: "Giao Hàng Nhanh Shipping",
    })

    if (existingOptions.length === 0) {
      logger.info("[seed-cuchi] Tạo Shipping Option 'Giao Hàng Nhanh Shipping' (calculated)...")
      await createShippingOptionsWorkflow(container).run({
        input: [
          {
            name: "Giao Hàng Nhanh Shipping",
            price_type: "calculated",
            provider_id: "ghn_ghn",
            service_zone_id: serviceZone.id,
            shipping_profile_id: shippingProfileId,
            type: {
              label: "Giao Hàng Nhanh",
              description: "GHN Delivery",
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
        ],
      })
      logger.info("[seed-cuchi] ✔ Đã tạo xong Shipping Option 'Giao Hàng Nhanh Shipping'!")
    }
  }

  logger.info("[seed-cuchi] Hoàn tất thiết lập Kho Củ Chi SOC thành công 100%!")
}
