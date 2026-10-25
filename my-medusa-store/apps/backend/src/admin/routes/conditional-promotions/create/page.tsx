import { Button, Container, Heading, Text, toast } from "@medusajs/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
    ConditionalPromotionForm,
    buildConditionalPromotionPayload,
    conditionalPromotionErrorMessage,
    fetchConditionalPromotionOptions,
    initialConditionalPromotion,
} from "../index";
import { sdk } from "../../../lib/sdk";

const CreatePage = () => {
    const navigate = useNavigate();
    const { data: options } = useQuery({
        queryKey: ["conditional-options"],
        queryFn: fetchConditionalPromotionOptions,
    });
    const save = useMutation({
        mutationFn: (body: any) =>
            sdk.client.fetch<any>("/admin/conditional-promotions", { method: "POST", body }),
        onSuccess: (data) => {
            toast.success("Conditional promotion created");
            navigate(`/conditional-promotions/${data.conditional_promotion.id}`);
        },
        onError: (error) =>
            toast.error(
                conditionalPromotionErrorMessage(
                    error,
                    "Could not create promotion. Please review the form and try again.",
                ),
            ),
    });
    return (
        <Container className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden bg-ui-bg-subtle p-0">
            <header className="z-10 shrink-0 border-b border-ui-border-base bg-ui-bg-base px-6 py-5 shadow-elevation-card-rest">
                <div className="mx-auto max-w-7xl">
                    <Button
                        size="small"
                        variant="primary"
                        onClick={() => navigate("/conditional-promotions")}
                    >
                        Back to promotions
                    </Button>
                    <Heading className="mt-3" level="h1">
                        Create conditional promotion
                    </Heading>
                    <Text className="mt-1 text-ui-fg-subtle">
                        Build an automatic benefit from cart rules. Customers will not be able to
                        enter its code.
                    </Text>
                </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                {options && (
                    <ConditionalPromotionForm
                        initial={initialConditionalPromotion}
                        options={options}
                        isSaving={save.isPending}
                        onValidationError={(message: string) => toast.error(message)}
                        onCancel={() => navigate("/conditional-promotions")}
                        onSubmit={(value: any) =>
                            save.mutate(buildConditionalPromotionPayload(value, "active"))
                        }
                    />
                )}
            </div>
        </Container>
    );
};

export default CreatePage;
