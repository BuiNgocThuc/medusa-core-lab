import { Button, Container, Heading, Switch, Text, toast } from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    ConditionalPromotionForm,
    buildConditionalPromotionPayload,
    conditionalPromotionErrorMessage,
    fetchConditionalPromotionOptions,
    toFormConditions,
    toFormMatcher,
} from "../index";
import { sdk } from "../../../lib/sdk";

const EditPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isActive, setIsActive] = useState(false);
    const { data: options } = useQuery({
        queryKey: ["conditional-options"],
        queryFn: fetchConditionalPromotionOptions,
    });
    const { data, isLoading } = useQuery({
        queryKey: ["conditional-promotion", id],
        queryFn: () =>
            sdk.client.fetch<any>(`/admin/conditional-promotions/${id}`, { method: "GET" }),
        enabled: Boolean(id),
    });
    const currentStatus = data?.conditional_promotion?.status;
    useEffect(() => {
        if (currentStatus) {
            setIsActive(currentStatus === "active");
        }
    }, [id, currentStatus]);
    const save = useMutation({
        mutationFn: (body: any) =>
            sdk.client.fetch<any>(`/admin/conditional-promotions/${id}`, { method: "POST", body }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["conditional-promotions"] });
            toast.success("Conditional promotion updated");
            navigate("/conditional-promotions");
        },
        onError: (error) =>
            toast.error(
                conditionalPromotionErrorMessage(
                    error,
                    "Could not update promotion. Please review the form and try again.",
                ),
            ),
    });
    if (isLoading || !options || !data)
        return (
            <Container className="p-6">
                <Text className="text-ui-fg-subtle">Loading promotion…</Text>
            </Container>
        );
    const conditional = data.conditional_promotion;
    const carrier = data.promotion;
    const initial = {
        title: conditional.title,
        code: carrier.code,
        percentage: carrier.application_method?.value ?? 100,
        max_quantity: conditional.max_quantity,
        priority: conditional.priority,
        description: conditional.description ?? "",
        terms: conditional.terms ?? "",
        cta_url: conditional.cta_url ?? "",
        conditions: toFormConditions(conditional.rule_tree.conditions),
        target: toFormMatcher(conditional.target),
    };
    return (
        <Container className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden bg-ui-bg-subtle p-0">
            <header className="z-10 shrink-0 border-b border-ui-border-base bg-ui-bg-base px-6 py-5 shadow-elevation-card-rest">
                <div className="mx-auto max-w-7xl">
                    <div>
                        <Button
                            size="small"
                            variant="primary"
                            onClick={() => navigate("/conditional-promotions")}
                        >
                            Back to promotions
                        </Button>
                        <Heading className="mt-3" level="h1">
                            Edit conditional promotion
                        </Heading>
                        <Text className="mt-1 text-ui-fg-subtle">
                            Changes apply on the next cart refresh and are validated again at
                            checkout.
                        </Text>
                    </div>
                </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                <ConditionalPromotionForm
                    initial={initial}
                    options={options}
                    isSaving={save.isPending}
                    submitLabel="Save changes"
                    onValidationError={(message: string) => toast.error(message)}
                    onCancel={() => navigate("/conditional-promotions")}
                    sidebarFooter={
                        <section className="flex items-center justify-between rounded-xl border border-ui-border-base bg-ui-bg-base px-5 py-4 shadow-elevation-card-rest">
                            <div>
                                <Text className="txt-small-plus text-ui-fg-base">
                                    Promotion status
                                </Text>
                                <Text className="mt-1 text-ui-fg-subtle">
                                    {isActive
                                        ? "Active and eligible for cart refresh"
                                        : "Inactive and excluded from cart refresh"}
                                </Text>
                            </div>
                            <Switch checked={isActive} onCheckedChange={setIsActive} />
                        </section>
                    }
                    onSubmit={(value: any) =>
                        save.mutate(
                            buildConditionalPromotionPayload(
                                value,
                                isActive ? "active" : "inactive",
                                conditional.placements ?? { category_ids: [], collection_ids: [] },
                            ),
                        )
                    }
                />
            </div>
        </Container>
    );
};

export default EditPage;
