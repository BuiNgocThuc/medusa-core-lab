import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types";
import { Avatar, Badge, Container, Copy, Heading, Text } from "@medusajs/ui";

// 1. Cấu hình Entry Point cho Medusa Admin SDK (Framework Contract - Không xóa)
export const config = defineWidgetConfig({
    zone: "order.details",
});

// 2. Helper trích xuất chữ cái đại diện (Initials) cho Avatar
function getCustomerInitials(customer?: HttpTypes.AdminCustomer | null): string {
    const name = `${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim();
    if (name) {
        return name
            .split(/\s+/)
            .map((part) => part[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();
    }
    return customer?.email?.slice(0, 2).toUpperCase() || "?";
}

// 3. Component con dùng chung: Loại bỏ triệt để cảnh báo trùng lặp code (Duplicated code fragment)
interface InfoFieldProps {
    label: string;
    value?: string | null;
    copyAriaLabel: string;
}

const InfoField = ({ label, value, copyAriaLabel }: InfoFieldProps) => (
    <div className="flex flex-col gap-y-1">
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
            {label}
        </Text>
        <div className="flex items-center gap-x-2">
            <Text size="small" weight="plus" className="text-ui-fg-base truncate">
                {value || "Không có"}
            </Text>
            {value && <Copy content={value} variant="mini" aria-label={copyAriaLabel} />}
        </div>
    </div>
);

// 4. Component Widget chính
const OrderTransferDetailsWidget = ({ data: order }: DetailWidgetProps<HttpTypes.AdminOrder>) => {
    const customer = order.customer;
    const isRegistered = customer?.has_account === true;
    const initials = getCustomerInitials(customer);

    const customerFullName = [customer?.first_name, customer?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();

    const isEmailMismatched =
        Boolean(order.email) &&
        Boolean(customer?.email) &&
        order.email?.toLowerCase() !== customer?.email?.toLowerCase();

    // Helper hiển thị Badge: Loại bỏ cảnh báo SonarQube S3358 (Nested ternary)
    const renderCustomerBadge = () => {
        if (!customer) {
            return <Badge color="red">Unassigned</Badge>;
        }
        if (isRegistered) {
            return <Badge color="green">Registered Member</Badge>;
        }
        return <Badge color="grey">Guest Customer</Badge>;
    };

    return (
        <Container className="divide-y p-0">
            {/* Tiêu đề Widget */}
            <div className="flex items-center justify-between px-6 py-4">
                <Heading level="h2">Customer Ownership | Quyền Sở Hữu Đơn Hàng</Heading>
                {renderCustomerBadge()}
            </div>

            {/* Thông tin Khách hàng Sở hữu */}
            <div className="flex flex-col gap-y-3 px-6 py-4">
                <Text size="small" leading="compact" weight="plus" className="text-ui-fg-subtle">
                    Current Owner | Chủ Sở Hữu Hiện Tại
                </Text>

                <div className="flex items-center gap-x-3 min-w-0">
                    <Avatar fallback={initials} variant="rounded" size="large" />
                    <div className="flex flex-col gap-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-x-2">
                            <Text size="base" weight="plus" className="text-ui-fg-base truncate">
                                {customerFullName || customer?.email || "Chưa có tên khách hàng"}
                            </Text>
                        </div>
                        {customer?.id && (
                            <div className="flex items-center gap-x-2">
                                <Text
                                    size="small"
                                    leading="compact"
                                    className="font-mono text-ui-fg-muted truncate"
                                >
                                    {customer.id}
                                </Text>
                                <Copy
                                    content={customer.id}
                                    variant="mini"
                                    aria-label="Copy Customer ID"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bảng Đối soát Email: Sử dụng InfoField tái sử dụng */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-6 py-4">
                <InfoField
                    label="Order Contact Email | Email Đơn Hàng"
                    value={order.email}
                    copyAriaLabel="Copy Order Email"
                />
                <InfoField
                    label="Customer Account Email | Email Tài Khoản"
                    value={customer?.email}
                    copyAriaLabel="Copy Customer Email"
                />
            </div>

            {/* Cảnh báo khi có sự sai khác Email */}
            {isEmailMismatched && (
                <div className="px-6 py-3 bg-ui-bg-subtle-hover flex items-center justify-between">
                    <Text size="small" leading="compact" className="text-ui-fg-muted">
                        Lưu ý: Email liên hệ của đơn hàng khác với Email tài khoản chủ sở hữu.
                    </Text>
                    <Badge color="orange">Transferred / Mismatched</Badge>
                </div>
            )}
        </Container>
    );
};

export default OrderTransferDetailsWidget;
