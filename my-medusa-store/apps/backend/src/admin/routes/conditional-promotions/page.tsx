import { EllipsisHorizontal, PencilSquare, Trash } from "@medusajs/icons";
import { defineRouteConfig } from "@medusajs/admin-sdk";
import {
    Button,
    Container,
    DataTable,
    DropdownMenu,
    Heading,
    IconButton,
    Prompt,
    Text,
    createDataTableColumnHelper,
    toast,
    useDataTable,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sdk } from "../../lib/sdk";

type ConditionalPromotion = {
    id: string;
    code?: string;
    status: "active" | "inactive";
    percentage?: number;
    max_quantity: number;
};

const columnHelper = createDataTableColumnHelper<ConditionalPromotion>();

const PageHeader = ({ onCreate }: { onCreate: () => void }) => (
    <>
        <div>
            <Heading level="h1">Conditional promotions</Heading>
            <Text className="mt-1 text-ui-fg-subtle">
                Automatic benefits evaluated from cart contents.
            </Text>
        </div>
        <Button onClick={onCreate}>Create promotion</Button>
    </>
);

const EmptyState = ({ onCreate }: { onCreate: () => void }) => (
    <div className="px-6 py-14 text-center">
        <Heading level="h2">No conditional promotions yet</Heading>
        <Text className="mx-auto mt-2 max-w-md text-ui-fg-subtle">
            Create an automatic benefit when a cart meets all business rules.
        </Text>
        <Button className="mt-5" onClick={onCreate}>
            Create promotion
        </Button>
    </div>
);

const PromotionActions = ({
    promotion,
    onEdit,
    onDelete,
}: {
    promotion: ConditionalPromotion;
    onEdit: () => void;
    onDelete: () => void;
}) => (
    <DropdownMenu>
        <DropdownMenu.Trigger asChild>
            <IconButton
                variant="transparent"
                size="small"
                onClick={(event) => event.stopPropagation()}
            >
                <EllipsisHorizontal className="size-5" />
                <span className="sr-only">Actions for {promotion.code}</span>
            </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
            <DropdownMenu.Item onClick={onEdit}>
                <PencilSquare className="mr-2 size-4" />
                Edit
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item className="text-ui-fg-error" onClick={onDelete}>
                <Trash className="mr-2 size-4" />
                Delete
            </DropdownMenu.Item>
        </DropdownMenu.Content>
    </DropdownMenu>
);

const PromotionTable = ({
    promotions,
    isLoading,
    onCreate,
    onEdit,
    onDelete,
}: {
    promotions: ConditionalPromotion[];
    isLoading: boolean;
    onCreate: () => void;
    onEdit: (id: string) => void;
    onDelete: (promotion: ConditionalPromotion) => void;
}) => {
    const columns = useMemo(
        () => [
            columnHelper.accessor("code", {
                header: "Code",
                cell: ({ getValue }) => (
                    <span className="inline-flex rounded-md bg-ui-alpha-250 px-2 py-1 font-mono text-xs text-ui-fg-base">
                        {getValue() ?? "No code"}
                    </span>
                ),
            }),
            columnHelper.display({
                id: "benefit",
                header: "Benefit",
                cell: ({ row }) => (
                    <div className="py-1">
                        <Text className="text-ui-fg-base">{row.original.percentage ?? 0}% off</Text>
                        <Text className="text-ui-fg-subtle">
                            Up to {row.original.max_quantity} item
                            {row.original.max_quantity === 1 ? "" : "s"}
                        </Text>
                    </div>
                ),
            }),
            columnHelper.accessor("status", {
                header: "Status",
                cell: ({ getValue }) => (
                    <div className="flex items-center gap-x-2 py-1 text-ui-fg-subtle">
                        <span
                            className={`size-2 rounded-sm shadow-[0px_0px_0px_1px_rgba(0,0,0,0.12)_inset] ${getValue() === "active" ? "bg-ui-tag-green-icon" : "bg-ui-tag-red-icon"}`}
                        />
                        <span>{getValue() === "active" ? "Active" : "Inactive"}</span>
                    </div>
                ),
            }),
            columnHelper.display({
                id: "actions",
                header: "",
                cell: ({ row }) => (
                    <div className="flex justify-end py-1">
                        <PromotionActions
                            promotion={row.original}
                            onEdit={() => onEdit(row.original.id)}
                            onDelete={() => onDelete(row.original)}
                        />
                    </div>
                ),
            }),
        ],
        [onDelete, onEdit],
    );
    const table = useDataTable({
        columns,
        data: promotions,
        getRowId: (promotion) => promotion.id,
        rowCount: promotions.length,
        isLoading,
        onRowClick: (_event, row) => onEdit(row.id),
    });

    return (
        <DataTable instance={table}>
            <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
                <PageHeader onCreate={onCreate} />
            </DataTable.Toolbar>
            <DataTable.Table />
        </DataTable>
    );
};

const ConditionalPromotionsPage = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [promotionToDelete, setPromotionToDelete] = useState<ConditionalPromotion | null>(
        null,
    );
    const { data, isLoading } = useQuery({
        queryKey: ["conditional-promotions"],
        queryFn: () => sdk.client.fetch<any>("/admin/conditional-promotions", { method: "GET" }),
    });
    const remove = useMutation({
        mutationFn: (id: string) =>
            sdk.client.fetch(`/admin/conditional-promotions/${id}`, { method: "DELETE" }),
        onSuccess: () => {
            setPromotionToDelete(null);
            queryClient.invalidateQueries({ queryKey: ["conditional-promotions"] });
            toast.success("Conditional promotion deleted");
        },
        onError: () => toast.error("Could not delete conditional promotion"),
    });
    const promotions = (data?.conditional_promotions ?? []) as ConditionalPromotion[];
    const create = () => navigate("/conditional-promotions/create");
    const edit = (id: string) => navigate(`/conditional-promotions/${id}`);
    const removePromotion = (promotion: ConditionalPromotion) => setPromotionToDelete(promotion);
    const confirmDelete = () => {
        if (promotionToDelete) remove.mutate(promotionToDelete.id);
    };

    return (
        <>
            <Container className="divide-y p-0">
                {!isLoading && !promotions.length ? (
                    <>
                        <div className="flex items-center justify-between px-6 py-4">
                            <PageHeader onCreate={create} />
                        </div>
                        <EmptyState onCreate={create} />
                    </>
                ) : (
                    <PromotionTable
                        promotions={promotions}
                        isLoading={isLoading}
                        onCreate={create}
                        onEdit={edit}
                        onDelete={removePromotion}
                    />
                )}
            </Container>
            <Prompt
                open={Boolean(promotionToDelete)}
                onOpenChange={(open) => {
                    if (!open) setPromotionToDelete(null);
                }}
                variant="danger"
            >
                <Prompt.Content>
                    <Prompt.Header>
                        <Prompt.Title>Delete conditional promotion?</Prompt.Title>
                        <Prompt.Description>
                            This will deactivate and archive{' '}
                            <span className="font-mono">{promotionToDelete?.code}</span>. It can
                            no longer be applied to carts.
                        </Prompt.Description>
                    </Prompt.Header>
                    <Prompt.Footer>
                        <Prompt.Cancel onClick={() => setPromotionToDelete(null)}>
                            Cancel
                        </Prompt.Cancel>
                        <Prompt.Action disabled={remove.isPending} onClick={confirmDelete}>
                            Delete promotion
                        </Prompt.Action>
                    </Prompt.Footer>
                </Prompt.Content>
            </Prompt>
        </>
    );
};

export const config = defineRouteConfig({ label: "Conditional promotions" });
export default ConditionalPromotionsPage;
