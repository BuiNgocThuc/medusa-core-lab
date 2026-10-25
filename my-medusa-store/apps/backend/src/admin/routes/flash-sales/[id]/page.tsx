import { ArrowLeft, CurrencyDollar, Tag, Trash } from "@medusajs/icons";
import { Button, Container, Heading, IconButton, Prompt, Text, toast } from "@medusajs/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { sdk } from "../../../lib/sdk";

const statusStyle: Record<
    string,
    { label: string; dot: string; badgeBg: string; description: string }
> = {
    active: {
        label: "Active",
        dot: "bg-emerald-500",
        badgeBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        description: "The voucher can be claimed in its active window.",
    },
    scheduled: {
        label: "Scheduled",
        dot: "bg-amber-500",
        badgeBg: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        description: "Waiting for the next scheduled window.",
    },
    inactive: {
        label: "Inactive",
        dot: "bg-rose-500",
        badgeBg: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        description: "Disabled by an administrator.",
    },
    due: {
        label: "Due",
        dot: "bg-zinc-400",
        badgeBg: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
        description: "The campaign has reached its end date.",
    },
};

const formatDate = (value?: string | null) =>
    value
        ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(
              new Date(value),
          )
        : "No limit";

const DetailRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-4 border-b border-ui-border-base/70 py-3.5 last:border-b-0">
        <Text size="small" className="shrink-0 text-ui-fg-subtle">
            {label}
        </Text>
        <div className="min-w-0 text-right">{children}</div>
    </div>
);

const FlashSaleDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [deleteOpen, setDeleteOpen] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ["flash-sale", id],
        queryFn: () => sdk.client.fetch<any>(`/admin/flash-sales/${id}`, { method: "GET" }),
    });

    const remove = useMutation({
        mutationFn: () => sdk.client.fetch(`/admin/flash-sales/${id}`, { method: "DELETE" }),
        onSuccess: () => {
            toast.success("Flash Sale deleted");
            navigate("/flash-sales");
        },
        onError: (error: any) => toast.error(error?.message ?? "Could not delete Flash Sale"),
    });

    if (isLoading || !data) {
        return (
            <div className="w-full space-y-6 p-6 lg:p-8">
                <div className="h-10 w-64 animate-pulse rounded bg-ui-bg-subtle" />
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <Container className="h-80 animate-pulse bg-ui-bg-subtle/40 p-6" />
                    <Container className="h-80 animate-pulse bg-ui-bg-subtle/40 p-6" />
                </div>
            </div>
        );
    }

    const sale = data.flash_sale;
    const promotion = data.promotion;
    const campaign = data.campaign;
    const style = statusStyle[sale.status] ?? statusStyle.scheduled;
    const budget = campaign?.budget;
    const budgetLabel =
        budget?.type === "usage"
            ? `${budget.limit ?? "—"} claims`
            : `${Number(budget?.limit ?? 0).toLocaleString("vi-VN")} ${budget?.currency_code?.toUpperCase() ?? "VND"}`;

    return (
        <div className="w-full space-y-6 p-6 lg:p-8">
            {/* Header Section */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-ui-border-base pb-6">
                <div className="flex items-center gap-3.5">
                    <IconButton
                        variant="transparent"
                        size="base"
                        onClick={() => navigate("/flash-sales")}
                        className="rounded-lg border border-ui-border-base shadow-xs hover:bg-ui-bg-subtle"
                    >
                        <ArrowLeft className="size-4" />
                        <span className="sr-only">Back to Flash Sales</span>
                    </IconButton>

                    <div>
                        <div className="flex items-center gap-2.5">
                            <Heading
                                level="h1"
                                className="text-xl font-bold tracking-tight text-ui-fg-base"
                            >
                                Flash Sale Details
                            </Heading>
                            <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style.badgeBg}`}
                            >
                                <span className={`size-1.5 rounded-full ${style.dot}`} />
                                {style.label}
                            </span>
                        </div>
                        <Text size="small" className="mt-0.5 text-ui-fg-subtle">
                            {style.description}
                        </Text>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="danger"
                        size="small"
                        onClick={() => setDeleteOpen(true)}
                        className="shadow-xs"
                    >
                        <Trash className="mr-1.5 size-4" />
                        Delete Flash Sale
                    </Button>
                </div>
            </div>

            <Prompt open={deleteOpen} onOpenChange={setDeleteOpen}>
                <Prompt.Content>
                    <Prompt.Header>
                        <Prompt.Title>Delete Flash Sale?</Prompt.Title>
                        <Prompt.Description>
                            This disables the voucher, releases active claims, and removes the
                            schedule from the Admin list.
                        </Prompt.Description>
                    </Prompt.Header>
                    <Prompt.Footer>
                        <Prompt.Cancel>Cancel</Prompt.Cancel>
                        <Prompt.Action
                            variant="danger"
                            isLoading={remove.isPending}
                            onClick={() => remove.mutate()}
                        >
                            Delete Flash Sale
                        </Prompt.Action>
                    </Prompt.Footer>
                </Prompt.Content>
            </Prompt>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-ui-border-base bg-ui-bg-subtle/40 p-4">
                    <Text size="xsmall" className="text-ui-fg-subtle">
                        VOUCHER CODE
                    </Text>
                    <code className="mt-1 block font-mono text-base font-bold text-orange-400">
                        {promotion?.code ?? "No code"}
                    </code>
                </div>

                <div className="rounded-xl border border-ui-border-base bg-ui-bg-subtle/40 p-4">
                    <Text size="xsmall" className="text-ui-fg-subtle">
                        DISCOUNT VALUE
                    </Text>
                    <Text weight="plus" className="mt-1 text-base text-ui-fg-base">
                        {promotion?.application_method?.value ?? 0}%
                    </Text>
                </div>

                <div className="rounded-xl border border-ui-border-base bg-ui-bg-subtle/40 p-4">
                    <Text size="xsmall" className="text-ui-fg-subtle">
                        TIME WINDOW
                    </Text>
                    <Text weight="plus" className="mt-1 text-base font-mono text-ui-fg-base">
                        {sale.start_time} – {sale.end_time}
                    </Text>
                </div>

                <div className="rounded-xl border border-ui-border-base bg-ui-bg-subtle/40 p-4">
                    <Text size="xsmall" className="text-ui-fg-subtle">
                        BUDGET LIMIT
                    </Text>
                    <Text weight="plus" className="mt-1 text-base text-ui-fg-base">
                        {budgetLabel}
                    </Text>
                </div>
            </div>

            {/* Main Details Grid: 2 columns on lg/desktop screens */}
            <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
                {/* Column 1: Voucher & Schedule */}
                <Container className="flex flex-col justify-between overflow-hidden rounded-xl border border-ui-border-base p-0 shadow-xs">
                    <div>
                        <div className="flex items-center gap-2.5 border-b border-ui-border-base bg-ui-bg-subtle/60 px-6 py-4">
                            <Tag className="size-4 text-ui-fg-subtle" />
                            <div>
                                <Heading
                                    level="h2"
                                    className="text-sm font-semibold text-ui-fg-base"
                                >
                                    Voucher & Schedule
                                </Heading>
                                <Text size="xsmall" className="text-ui-fg-muted">
                                    Timing configuration and rules
                                </Text>
                            </div>
                        </div>

                        <div className="px-6 py-2">
                            <DetailRow label="Max discount amount">
                                <Text weight="plus" className="text-sm text-ui-fg-base">
                                    {Number(sale.max_discount_amount).toLocaleString("vi-VN")} VND
                                </Text>
                            </DetailRow>

                            <DetailRow label="Timezone">
                                <Text weight="plus" className="text-sm text-ui-fg-base">
                                    {sale.timezone}
                                </Text>
                            </DetailRow>

                            <DetailRow label="Applicable Days">
                                <div className="flex flex-wrap justify-end gap-1.5">
                                    {(sale.weekdays ?? []).length > 0 ? (
                                        ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                                            (dayName, idx) => {
                                                const isSelected = (sale.weekdays ?? []).includes(
                                                    idx,
                                                );
                                                return (
                                                    <span
                                                        key={dayName}
                                                        className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                                                            isSelected
                                                                ? "border border-ui-border-base bg-ui-bg-base text-ui-fg-base font-semibold shadow-2xs"
                                                                : "text-ui-fg-muted/40 opacity-40"
                                                        }`}
                                                    >
                                                        {dayName}
                                                    </span>
                                                );
                                            },
                                        )
                                    ) : (
                                        <Text size="small" className="text-ui-fg-muted">
                                            None
                                        </Text>
                                    )}
                                </div>
                            </DetailRow>

                            <DetailRow label="Created Window">
                                <Text size="small" className="font-mono text-ui-fg-subtle">
                                    Daily recurring ({sale.start_time} - {sale.end_time})
                                </Text>
                            </DetailRow>
                        </div>
                    </div>
                </Container>

                {/* Column 2: Campaign */}
                <Container className="flex flex-col justify-between overflow-hidden rounded-xl border border-ui-border-base p-0 shadow-xs">
                    <div>
                        <div className="flex items-center gap-2.5 border-b border-ui-border-base bg-ui-bg-subtle/60 px-6 py-4">
                            <CurrencyDollar className="size-4 text-ui-fg-subtle" />
                            <div>
                                <Heading
                                    level="h2"
                                    className="text-sm font-semibold text-ui-fg-base"
                                >
                                    Campaign
                                </Heading>
                                <Text size="xsmall" className="text-ui-fg-muted">
                                    Budget tracking and duration
                                </Text>
                            </div>
                        </div>

                        <div className="px-6 py-2">
                            <DetailRow label="Campaign Name">
                                <Text weight="plus" className="text-sm text-ui-fg-base">
                                    {campaign?.name ?? "No campaign"}
                                </Text>
                            </DetailRow>

                            <DetailRow label="Identifier">
                                <code className="rounded bg-ui-bg-subtle px-1.5 py-0.5 font-mono text-xs text-ui-fg-subtle">
                                    {campaign?.campaign_identifier ?? "—"}
                                </code>
                            </DetailRow>

                            <DetailRow label="Used amount">
                                <Text weight="plus" className="font-mono text-sm text-ui-fg-base">
                                    {Number(budget?.used ?? 0).toLocaleString("vi-VN")}
                                </Text>
                            </DetailRow>

                            <DetailRow label="Starts at">
                                <Text size="small" className="text-ui-fg-base">
                                    {formatDate(campaign?.starts_at)}
                                </Text>
                            </DetailRow>

                            <DetailRow label="Ends at">
                                <Text size="small" className="text-ui-fg-base">
                                    {formatDate(campaign?.ends_at)}
                                </Text>
                            </DetailRow>
                        </div>
                    </div>
                </Container>
            </div>
        </div>
    );
};

export default FlashSaleDetailPage;
