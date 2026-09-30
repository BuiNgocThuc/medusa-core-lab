import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { requestOrderTransferWorkflow, acceptOrderTransferWorkflow, } from "@medusajs/medusa/core-flows";

// Helper 1: Xac dinh nhan phan loai khach hang (Triet tieu Nested Ternary)
function getCustomerTypeLabel(customer?: { has_account?: boolean } | null): string {
    if (!customer) {
        return "Missing / Unassigned";
    }

    if (customer.has_account) {
        return "Registered Member (has_account = true)";
    }

    return "Guest Customer (has_account = false)";
}

// Helper 2: Kiem tra Phase 1 (Customer Identity & DB Index Contract)
async function verifyCustomerContract(query: any, customerService: any, logger: any) {
    if (!customerService) {
        logger.error("[PHASE 1 FAIL] Cannot resolve Modules.CUSTOMER from container.");
        return false;
    }

    logger.info("[PHASE 1 OK] Modules.CUSTOMER resolved successfully.");

    const { data: allCustomers } = await query.graph({
        entity: "customer",
        fields: ["id", "email", "has_account", "created_at"],
    });

    const totalCount = allCustomers?.length || 0;
    const guestCount = allCustomers?.filter((c: any) => !c.has_account).length || 0;
    const registeredCount = allCustomers?.filter((c: any) => c.has_account).length || 0;

    logger.info(`[PHASE 1 STATS] Total Customers: ${totalCount}`);
    logger.info(`  - Guest Customers (has_account = false): ${guestCount}`);
    logger.info(`  - Registered Members (has_account = true): ${registeredCount}`);

    const emailMap = new Map<string, { guest?: string; registered?: string }>();

    for (const c of allCustomers || []) {
        // Guard clause: Tranh loi TS2345 khi c.email la null
        if (!c.email) {
            continue;
        }

        const entry = emailMap.get(c.email) || {};
        if (c.has_account) {
            entry.registered = c.id;
        } else {
            entry.guest = c.id;
        }
        emailMap.set(c.email, entry);
    }

    const coexistingEmails = Array.from(emailMap.entries()).filter(
        ([, val]) => Boolean(val.guest) && Boolean(val.registered),
    );

    logger.info(`[PHASE 1 INDEX] Coexisting Guest & Registered emails: ${coexistingEmails.length}`);

    for (const [email, ids] of coexistingEmails.slice(0, 5)) {
        logger.info(`  * Email: ${email}`);
        logger.info(`    - Guest ID: ${ids.guest}`);
        logger.info(`    - Registered ID: ${ids.registered}`);
    }

    return true;
}

// Helper 3: Kiem tra Phase 2 (Core Workflows Readiness)
function verifyCoreWorkflows(logger: any): boolean {
    logger.info("--------------------------------------------------------------------------------");
    logger.info("[PHASE 2] Checking Core Workflows readiness...");

    const isRequestReady = typeof requestOrderTransferWorkflow === "function";
    const isAcceptReady = typeof acceptOrderTransferWorkflow === "function";

    if (!isRequestReady || !isAcceptReady) {
        logger.error(
            `[PHASE 2 FAIL] Workflow import failed: request (${isRequestReady}), accept (${isAcceptReady})`,
        );
        return false;
    }

    logger.info("[PHASE 2 OK] requestOrderTransferWorkflow: READY");
    logger.info("[PHASE 2 OK] acceptOrderTransferWorkflow: READY");
    return true;
}

// Helper 4: Kiem tra Phase 3 chi tiet theo Order ID
async function verifyTargetOrder(query: any, logger: any, targetOrderId: string) {
    logger.info(`[PHASE 3] Inspecting target order: ${targetOrderId}`);

    const { data: orders } = await query.graph({
        entity: "order",
        fields: ["id", "display_id", "status", "email", "customer_id", "customer.*", "created_at"],
        filters: { id: targetOrderId },
    });

    const targetOrder = orders?.[0];
    if (!targetOrder) {
        logger.warn(`[PHASE 3 WARN] Order not found: ${targetOrderId}`);
        return;
    }

    const customerLabel = getCustomerTypeLabel((targetOrder as any).customer);

    logger.info(`[ORDER DETAILS] ID: ${targetOrder.id} (Display ID: #${targetOrder.display_id})`);
    logger.info(`  - Status: ${targetOrder.status}`);
    logger.info(`  - Order Email: ${targetOrder.email || "No email"}`);
    logger.info(`  - Customer ID: ${targetOrder.customer_id || "Unassigned"}`);
    logger.info(`  - Customer Type: ${customerLabel}`);

    const { data: orderChanges } = await query.graph({
        entity: "order_change",
        fields: [
            "id",
            "status",
            "change_type",
            "created_at",
            "confirmed_at",
            "canceled_at",
            "actions.*",
        ],
        filters: { order_id: targetOrderId },
    });

    const transferChanges = (orderChanges || []).filter((change: any) =>
        change.actions?.some((action: any) => action.action?.toLowerCase() === "transfer_customer"),
    );

    logger.info(
        `[ORDER TRANSFER CHANGES] Found ${transferChanges.length} transfer_customer actions`,
    );

    for (const change of transferChanges) {
        const action = change.actions?.find((a: any) => a.action?.toLowerCase() === "transfer_customer");
        const token = typeof action?.details?.token === "string" ? action.details.token : undefined;
        const createdAt = change.created_at ? new Date(change.created_at).getTime() : Date.now();
        const ageHours = (Date.now() - createdAt) / (1000 * 60 * 60);
        const isExpired = ageHours > 48;

        // Tach bien trung gian de tranh Nested Template Literals va [object]
        const tokenPreview = token ? `${token.substring(0, 8)}...` : "Missing Token";
        const remainingHours = Math.max(0, 48 - ageHours).toFixed(1);
        const ttlStatus = isExpired
            ? "EXPIRED (> 48h)"
            : `VALID (${remainingHours} hours remaining)`;
        const originalEmail =
            typeof action?.details?.original_email === "string"
                ? action.details.original_email
                : targetOrder.email || "Unknown";

        logger.info(`  * Change ID: ${change.id}`);
        logger.info(`    - Status: ${change.status}`);
        logger.info(
            `    - Target Customer ID: ${action?.reference_id || action?.details?.customer_id}`,
        );
        logger.info(`    - Original Email: ${originalEmail}`);
        logger.info(`    - Token UUID: ${tokenPreview}`);
        logger.info(`    - Token TTL Status: ${ttlStatus}`);
    }
}

// Helper 5: Kiem tra Phase 3 tong quat 5 don hang gan nhat
async function verifyRecentOrders(query: any, logger: any) {
    logger.info("[PHASE 3] Inspecting 5 most recent orders...");

    const { data: recentOrders } = await query.graph({
        entity: "order",
        fields: [
            "id",
            "display_id",
            "status",
            "email",
            "customer_id",
            "customer.has_account",
            "created_at",
        ],
        pagination: {
            take: 5,
            order: { created_at: "DESC" },
        },
    });

    if (!recentOrders || recentOrders.length === 0) {
        logger.info("[PHASE 3 INFO] No orders found in system.");
        return;
    }

    logger.info(`[PHASE 3 INFO] Found ${recentOrders.length} recent orders:`);
    for (const order of recentOrders) {
        const customer = (order as any).customer;
        const ownerType = getCustomerTypeLabel(customer);
        logger.info(
            `  * #${order.display_id} (${order.id}) - Email: ${order.email} | Owner: ${ownerType} | Status: ${order.status}`,
        );
    }

    logger.info("--------------------------------------------------------------------------------");
    logger.info("[GUIDE] To inspect a specific order in detail, run:");
    logger.info("  pnpm exec medusa exec ./src/scripts/verify-order-transfer.ts <order_id>");
}

// noinspection JSUnusedGlobalSymbols
export default async function verifyOrderTransfer({ container, args }: ExecArgs) {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const customerService = container.resolve(Modules.CUSTOMER);

    logger.info("================================================================================");
    logger.info("[TASK-007] STARTING VERIFICATION: ACCOUNT RECONCILIATION & ORDER TRANSFER");
    logger.info("================================================================================");

    // 1. Phase 1: Customer Identity Contract
    const isCustomerValid = await verifyCustomerContract(query, customerService, logger);
    if (!isCustomerValid) {
        return;
    }

    // 2. Phase 2: Core Workflows Readiness
    const isWorkflowsReady = verifyCoreWorkflows(logger);
    if (!isWorkflowsReady) {
        return;
    }

    // 3. Phase 3: Order & Transfer State Audit
    logger.info("--------------------------------------------------------------------------------");
    const targetOrderId = args?.[0];

    if (targetOrderId) {
        await verifyTargetOrder(query, logger, targetOrderId);
    } else {
        await verifyRecentOrders(query, logger);
    }

    logger.info("================================================================================");
    logger.info("[TASK-007 SUCCESS] ORDER TRANSFER INFRASTRUCTURE VERIFICATION COMPLETED 100%");
    logger.info("================================================================================");
}
