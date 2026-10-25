import { EllipsisHorizontal, Eye, CheckCircle, XCircle } from "@medusajs/icons";
import { defineRouteConfig } from "@medusajs/admin-sdk";
import {
    Button,
    Container,
    DropdownMenu,
    Heading,
    IconButton,
    Table,
    Text,
    toast,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { sdk } from "../../lib/sdk";

type FlashSale = {
    id: string;
    status: "active" | "inactive" | "scheduled";
    runtime_status: "active" | "inactive" | "scheduled" | "due";
    start_time: string;
    end_time: string;
    timezone: string;
    promotion?: { code?: string };
};

const statusStyle: Record<FlashSale["runtime_status"], { label: string; dot: string }> = {
    active: { label: "Active", dot: "bg-ui-tag-green-icon" },
    inactive: { label: "Inactive", dot: "bg-ui-tag-red-icon" },
    scheduled: { label: "Scheduled", dot: "bg-ui-tag-orange-icon" },
    due: { label: "Due", dot: "bg-ui-tag-neutral-icon" },
};

const FlashSalesPage = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: ["flash-sales"],
        queryFn: () =>
            sdk.client.fetch<{ flash_sales: FlashSale[] }>("/admin/flash-sales", { method: "GET" }),
    });
    const toggle = useMutation({
        mutationFn: (id: string) =>
            sdk.client.fetch(`/admin/flash-sales/${id}/toggle`, { method: "POST" }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["flash-sales"] });
            toast.success("Flash Sale updated");
        },
        onError: () => toast.error("Could not update Flash Sale"),
    });
    const sales = data?.flash_sales ?? [];
    return (
        <Container className="p-0">
            <div className="flex items-center justify-between px-6 py-5">
                <div>
                    <Heading level="h1">Flash Sales</Heading>
                    <Text className="mt-1 text-ui-fg-subtle">
                        Public vouchers with a limited claim window.
                    </Text>
                </div>
                <Button onClick={() => navigate("/flash-sales/create")}>Create Flash Sale</Button>
            </div>
            <Table>
                <Table.Header>
                    <Table.Row>
                        <Table.HeaderCell>Code</Table.HeaderCell>
                        <Table.HeaderCell>Schedule</Table.HeaderCell>
                        <Table.HeaderCell>Status</Table.HeaderCell>
                        <Table.HeaderCell />
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {!isLoading &&
                        sales.map((sale) => {
                            const style = statusStyle[sale.runtime_status];
                            return (
                                <Table.Row
                                    key={sale.id}
                                    onClick={() => navigate(`/flash-sales/${sale.id}`)}
                                    className="cursor-pointer"
                                >
                                    <Table.Cell>
                                        <span className="rounded-md bg-ui-alpha-250 px-2 py-1 font-mono text-xs">
                                            {sale.promotion?.code ?? "No code"}
                                        </span>
                                    </Table.Cell>
                                    <Table.Cell>
                                        {sale.start_time}–{sale.end_time} · {sale.timezone}
                                    </Table.Cell>
                                    <Table.Cell>
                                        <div className="flex items-center gap-x-2 text-ui-fg-subtle">
                                            <span
                                                className={`size-2 rounded-sm shadow-[0_0_0_1px_rgba(0,0,0,0.12)_inset] ${style.dot}`}
                                            />
                                            <span>{style.label}</span>
                                        </div>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <div className="flex justify-end">
                                            <DropdownMenu>
                                                <DropdownMenu.Trigger asChild>
                                                    <IconButton
                                                        variant="transparent"
                                                        size="small"
                                                        onClick={(event) => event.stopPropagation()}
                                                    >
                                                        <EllipsisHorizontal className="size-5" />
                                                        <span className="sr-only">
                                                            Flash Sale actions
                                                        </span>
                                                    </IconButton>
                                                </DropdownMenu.Trigger>
                                                <DropdownMenu.Content align="end">
                                                    <DropdownMenu.Item
                                                        onClick={() =>
                                                            navigate(`/flash-sales/${sale.id}`)
                                                        }
                                                    >
                                                        <Eye className="mr-2 size-4" />
                                                        View
                                                    </DropdownMenu.Item>
                                                    <DropdownMenu.Item
                                                        onClick={() => toggle.mutate(sale.id)}
                                                    >
                                                        {sale.status === "inactive" ? (
                                                            <CheckCircle className="mr-2 size-4" />
                                                        ) : (
                                                            <XCircle className="mr-2 size-4" />
                                                        )}

                                                        {sale.status === "inactive"
                                                            ? "Enable"
                                                            : "Disable"}
                                                    </DropdownMenu.Item>
                                                </DropdownMenu.Content>
                                            </DropdownMenu>
                                        </div>
                                    </Table.Cell>
                                </Table.Row>
                            );
                        })}
                </Table.Body>
            </Table>
        </Container>
    );
};

export const config = defineRouteConfig({ label: "Flash Sales" });
export default FlashSalesPage;
