import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types";
import { Avatar, Badge, Container, Copy, Heading, Text } from "@medusajs/ui";

// 1. Widget Configuration | Cấu hình vị trí hiển thị của Widget
// Báo cho Medusa Admin biết widget này được gắn vào trang Customer Details
export const config = defineWidgetConfig({
  zone: "customer.details",
});

// 2. Data Types & Contracts | Định nghĩa kiểu dữ liệu cho Helper
interface ValidatedUrl {
  rawUrl: string;
  hostname: string;
}

// 3. Defensive Helpers | Các hàm xử lý dữ liệu phòng thủ độc lập

// Xác thực URL ảnh: Chống URL dị tật, chỉ chấp nhận giao thức http: và https:
function parseHttpUrl(url: unknown): ValidatedUrl | null {
  if (typeof url !== "string") {
    return null;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return {
      rawUrl: trimmed,
      hostname: parsed.hostname,
    };
  } catch {
    return null;
  }
}

// Xác thực Zalo ID: Định dạng chuỗi số từ 8 đến 20 ký tự
function getValidZaloId(id: unknown): string | null {
  if (typeof id !== "string") {
    return null;
  }

  const trimmed = id.trim();
  return /^\d{8,20}$/.test(trimmed) ? trimmed : null;
}

// Trích xuất Initials: Fallback đa tầng (Tên + Họ -> Tên -> Họ -> Email -> "?")
function getCustomerInitials(customer: HttpTypes.AdminCustomer): string {
  const first = customer.first_name?.trim();
  const last = customer.last_name?.trim();

  if (first && last) {
    return `${first[0]}${last[0]}`.toUpperCase();
  }

  if (first) {
    return first.slice(0, 2).toUpperCase();
  }

  if (last) {
    return last.slice(0, 2).toUpperCase();
  }

  const email = customer.email?.trim();
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }

  return "?";
}

// 4. Widget Component | Khối giao diện chính tích hợp Medusa UI
const CustomerExtraDetails = ({
  data: customer,
}: DetailWidgetProps<HttpTypes.AdminCustomer>) => {
  const metadata = (customer?.metadata || {}) as Record<string, unknown>;
  const avatarData = parseHttpUrl(metadata.avatar_url);
  const validZaloId = getValidZaloId(metadata.zalo_id);
  const initials = getCustomerInitials(customer);

  return (
    <Container className="divide-y p-0">
      {/* Header Widget */}
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Extra Information | Thông tin Bổ sung</Heading>
      </div>

      {/* Hàng thông tin Avatar Profile */}
      <div className="flex flex-col gap-y-2 px-6 py-4">
        <Text
          size="small"
          leading="compact"
          weight="plus"
          className="text-ui-fg-subtle"
        >
          Avatar Profile
        </Text>
        <div className="flex items-center gap-x-3 min-w-0">
          <Avatar
            src={avatarData?.rawUrl}
            fallback={initials}
            variant="rounded"
            size="large"
          />
          {avatarData ? (
            <div className="flex items-center gap-x-2 min-w-0 flex-1">
              <Text
                size="small"
                leading="compact"
                className="truncate font-mono text-ui-fg-subtle"
                title={avatarData.rawUrl}
              >
                {avatarData.hostname}
              </Text>
              <Copy
                content={avatarData.rawUrl}
                variant="mini"
                aria-label="Copy Avatar URL"
              />
            </div>
          ) : (
            <Text size="small" leading="compact" className="text-ui-fg-muted">
              Chưa có ảnh đại diện
            </Text>
          )}
        </div>
      </div>

      {/* Hàng thông tin Zalo ID */}
      <div className="flex flex-col gap-y-2 px-6 py-4">
        <Text
          size="small"
          leading="compact"
          weight="plus"
          className="text-ui-fg-subtle"
        >
          Zalo ID
        </Text>
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {validZaloId ? (
            <>
              <Badge color="blue" className="font-mono max-w-full">
                <span className="break-all">{validZaloId}</span>
              </Badge>
              <Copy
                content={validZaloId}
                variant="mini"
                aria-label="Copy Zalo ID"
              />
            </>
          ) : (
            <Text size="small" leading="compact" className="text-ui-fg-muted">
              Chưa có Zalo ID
            </Text>
          )}
        </div>
      </div>
    </Container>
  );
};

export default CustomerExtraDetails;
