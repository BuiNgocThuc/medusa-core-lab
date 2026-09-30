import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export type OrderTransferRequestedEventData = {
    id: string;
    order_change_id: string;
};

export default async function orderTransferRequestedHandler({ event: { data }, container, }: SubscriberArgs<OrderTransferRequestedEventData>) {

    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    const orderId = data.id;

    const orderChangeId = data.order_change_id;

    logger.info(`[order-transfer-requested] Event received for order: ${orderId}, order_change: ${orderChangeId}`,);

    try {
        // 1. Truy van ban ghi order_change va danh sach actions lien quan thong qua Query Graph
        const { data: orderChanges } = await query.graph({
            entity: "order_change",
            fields: ["id", "status", "change_type", "actions.*"],
            filters: { id: orderChangeId },
        });

        const orderChange = orderChanges?.[0];

        if (!orderChange) {
            logger.warn(
                `[order-transfer-requested] Order change ${orderChangeId} not found for order ${orderId}. Skipping.`,
            );
            return;
        }

        // 2. Tim kiem action chuyen giao khach hang (TRANSFER_CUSTOMER / transfer_customer)
        const transferAction = orderChange.actions?.find(
            (action: any) => action.action?.toLowerCase() === "transfer_customer",
        );

        if (!transferAction) {
            logger.warn(
                `[order-transfer-requested] No transfer_customer action found in order change ${orderChangeId}. Skipping.`,
            );
            return;
        }

        // 3. Trich xuat token UUID v4 tu details cua action
        const token = transferAction.details?.token as string | undefined;

        if (!token) {
            logger.error(
                `[order-transfer-requested] Token missing in transfer_customer action details for order ${orderId}`,
            );
            return;
        }

        // 4. Xay dung callback URL cho Storefront
        const storefrontUrl = process.env.STOREFRONT_URL || "http://localhost:8000";
        const confirmationUrl = `${storefrontUrl}/order/${orderId}/transfer/${token}/accept`;

        // 5. Ghi log thong tin xac nhan (Delivery Bridge)
        logger.info(
            `[order-transfer-requested] Order transfer confirmation URL generated: ${confirmationUrl}`,
        );
        logger.info(
            `[order-transfer-requested] Transfer token successfully extracted: ${token} (Original Email: ${transferAction.details?.original_email})`,
        );
    } catch (error) {
        logger.error(
            `[order-transfer-requested] Error processing order transfer request for order ${orderId}:`,
            error,
        );
        throw error;
    }
}

export const config: SubscriberConfig = {
    event: ["order.transfer_requested", "order.transfer-requested"],
};
