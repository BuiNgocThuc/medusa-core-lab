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
 * Script thiết lập hệ thống Kho vận chuyển GHN:
 * 1. South Warehouse (Kho miền Nam):
 *    - Tên: South Warehouse
 *    - Địa chỉ: 123 Đường Hiệp Bình, Phường Hiệp Bình, TP. Thủ Đức, TP. Hồ Chí Minh
 *    - GHN v3: province_id: 1000001 (Hồ Chí Minh), ward_id: 1003573 (Phường Hiệp Bình)
 *    - GHN Legacy: province_id: 202, district_id: 3695 (Thành Phố Thủ Đức), ward_code: "90741" (Phường Hiệp Bình Chánh)
 *
 * 2. North Warehouse (Kho miền Bắc):
 *    - Tên: North Warehouse
 *    - Địa chỉ: 456 Đường Nguyễn Văn Linh, Phường Long Biên, Quận Long Biên, Hà Nội
 *    - GHN v3: province_id: 1000000 (Hà Nội), ward_id: 1003460 (Phường Long Biên)
 *    - GHN Legacy: province_id: 201, district_id: 1491 (Quận Long Biên), ward_code: "1A0906" (Phường Long Biên)
 *
 * Thực thi:
 *   pnpm --filter @dtc/backend exec medusa exec ./src/migration-scripts/seed-cuchi-location.ts
 */
export default async function seedStockLocations({
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

  logger.info("[seed-stock-locations] Bắt đầu thiết lập hệ thống Kho South Warehouse & North Warehouse...")

  // ==========================================
  // ĐỊA CHỈ & METADATA KHO SOUTH WAREHOUSE
  // ==========================================
  const southMetadata = {
    company: "South Warehouse",
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
  }

  const southAddress = {
    address_1: "123 Đường Hiệp Bình, Phường Hiệp Bình, TP. Thủ Đức, TP. Hồ Chí Minh",
    city: "Hồ Chí Minh",
    province: "Hồ Chí Minh",
    postal_code: "700000",
    country_code: "vn",
    phone: "0901234567",
    metadata: southMetadata,
  }

  // ==========================================
  // ĐỊA CHỈ & METADATA KHO NORTH WAREHOUSE
  // ==========================================
  const northMetadata = {
    company: "North Warehouse",
    ghn: {
      province_id: 1000000,
      province_name: "Hà Nội",
      ward_id: 1003460,
      ward_name: "Phường Long Biên",
      district_id: 1491,
      district_name: "Quận Long Biên",
      ward_code: "1A0906",
      is_new_address: true,
      name_extension: [
        "phường long biên",
        "p.long biên",
        "p long biên",
        "long biên",
        "long bien",
        "phuong long bien",
        "phuonglongbien",
        "longbien",
      ],
    },
    province_id: 1000000,
    province_name: "Hà Nội",
    ward_id: 1003460,
    ward_name: "Phường Long Biên",
    district_id: 1491,
    district_name: "Quận Long Biên",
    ward_code: "1A0906",
    v3_province_id: 1000000,
    v3_ward_id: 1003460,
    is_new_from_address: true,
    is_new_address: true,
  }

  const northAddress = {
    address_1: "456 Đường Nguyễn Văn Linh, Phường Long Biên, Quận Long Biên, Hà Nội",
    city: "Hà Nội",
    province: "Hà Nội",
    postal_code: "100000",
    country_code: "vn",
    phone: "0901234568",
    metadata: northMetadata,
  }

  // 1. Quản lý kho South Warehouse (chuyển đổi từ Củ Chi nếu có)
  const allLocations = await stockLocationModule.listStockLocations({})
  let southLocation = allLocations.find(
    (l: any) => l.name === "South Warehouse" || l.name.includes("Củ Chi")
  )

  if (southLocation) {
    logger.info(`[seed-stock-locations] Cập nhật South Warehouse từ vị trí có sẵn (${southLocation.id}, tên cũ: "${southLocation.name}")...`)
    await stockLocationModule.updateStockLocations(southLocation.id, {
      name: "South Warehouse",
      metadata: southMetadata,
    })
    if (southLocation.address_id) {
      await stockLocationModule.upsertStockLocationAddresses([
        {
          id: southLocation.address_id,
          ...southAddress,
        },
      ])
    }
  } else {
    logger.info("[seed-stock-locations] Tạo mới South Warehouse...")
    const { result: createdSouth } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: "South Warehouse",
            address: southAddress,
            metadata: southMetadata,
          },
        ],
      },
    })
    southLocation = createdSouth[0]
  }

  // 2. Quản lý kho North Warehouse
  let northLocation = allLocations.find(
    (l: any) => l.name === "North Warehouse" || l.name === "North WareHouse" || l.name.includes("Hà Nội")
  )

  if (northLocation) {
    logger.info(`[seed-stock-locations] Cập nhật North Warehouse (${northLocation.id})...`)
    await stockLocationModule.updateStockLocations(northLocation.id, {
      name: "North Warehouse",
      metadata: northMetadata,
    })
    if (northLocation.address_id) {
      await stockLocationModule.upsertStockLocationAddresses([
        {
          id: northLocation.address_id,
          ...northAddress,
        },
      ])
    }
  } else {
    logger.info("[seed-stock-locations] Tạo mới North Warehouse...")
    const { result: createdNorth } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: "North Warehouse",
            address: northAddress,
            metadata: northMetadata,
          },
        ],
      },
    })
    northLocation = createdNorth[0]
  }

  const activeLocations = [southLocation, northLocation]

  // 3. Liên kết Providers: ghn_ghn và manual_manual cho cả 2 kho
  logger.info("[seed-stock-locations] Liên kết các kho với Provider ghn_ghn và manual_manual...")
  for (const loc of activeLocations) {
    try {
      await link.create([
        {
          [Modules.STOCK_LOCATION]: { stock_location_id: loc.id },
          [Modules.FULFILLMENT]: { fulfillment_provider_id: "ghn_ghn" },
        },
        {
          [Modules.STOCK_LOCATION]: { stock_location_id: loc.id },
          [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
        },
      ])
    } catch (err: any) {
      // Đã link
    }
  }

  // 4. Liên kết Sales Channel với cả 2 kho
  const salesChannels = await salesChannelModule.listSalesChannels({
    name: "Default Sales Channel",
  })
  if (salesChannels.length > 0) {
    const scId = salesChannels[0].id
    for (const loc of activeLocations) {
      try {
        await linkSalesChannelsToStockLocationWorkflow(container).run({
          input: { id: loc.id, add: [scId] },
        })
      } catch (err: any) {
        // Đã link
      }
    }
  }

  // 5. Lấy hoặc tạo Fulfillment Set & Service Zone "Vietnam"
  const fulfillmentSets = await fulfillmentModuleService.listFulfillmentSets(
    { name: "Vietnam delivery" },
    { relations: ["service_zones", "service_zones.geo_zones"] }
  )

  let fulfillmentSet: any = fulfillmentSets[0]

  if (!fulfillmentSet) {
    logger.info("[seed-stock-locations] Tạo Fulfillment Set 'Vietnam delivery'...")
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

  // Liên kết các Stock Location với Fulfillment Set
  for (const loc of activeLocations) {
    try {
      await link.create({
        [Modules.STOCK_LOCATION]: { stock_location_id: loc.id },
        [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
      })
    } catch (err: any) {
      // Đã link
    }
  }

  // 6. Cấp inventory level (1000 quantity) cho cả 2 kho
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "location_levels.*"],
  })

  const levelsToCreate: any[] = []
  for (const loc of activeLocations) {
    for (const item of inventoryItems) {
      const hasLevel = (item as any).location_levels?.some(
        (lvl: any) => lvl.location_id === loc.id
      )
      if (!hasLevel) {
        levelsToCreate.push({
          location_id: loc.id,
          stocked_quantity: 1000,
          inventory_item_id: item.id,
        })
      }
    }
  }

  if (levelsToCreate.length > 0) {
    logger.info(`[seed-stock-locations] Khởi tạo tồn kho (${levelsToCreate.length} bản ghi) cho South & North Warehouses...`)
    try {
      await createInventoryLevelsWorkflow(container).run({
        input: {
          inventory_levels: levelsToCreate,
        },
      })
    } catch (err: any) {
      logger.warn(`[seed-stock-locations] Khởi tạo inventory: ${err?.message}`)
    }
  }

  // 7. Shipping Profile & Shipping Option "Giao Hàng Nhanh Shipping"
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
      logger.info("[seed-stock-locations] Tạo Shipping Option 'Giao Hàng Nhanh Shipping' (calculated)...")
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
      logger.info("[seed-stock-locations] ✔ Đã tạo xong Shipping Option 'Giao Hàng Nhanh Shipping'!")
    }
  }

  logger.info("[seed-stock-locations] Hoàn tất thiết lập South Warehouse và North Warehouse thành công 100%!")
}

export const seedCuChiLocation = seedStockLocations
