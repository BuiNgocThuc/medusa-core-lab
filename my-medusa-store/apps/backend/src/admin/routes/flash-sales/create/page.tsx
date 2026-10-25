import { Container, Heading, Text, toast } from "@medusajs/ui";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { FlashSaleForm } from "../../../components/flash-sale-form";
import { sdk } from "../../../lib/sdk";
const CreateFlashSalePage = () => {
    const navigate = useNavigate();
    const save = useMutation({
        mutationFn: (body: any) =>
            sdk.client.fetch<any>("/admin/flash-sales", { method: "POST", body }),
        onSuccess: (data) => {
            toast.success("Flash Sale created");
            navigate(`/flash-sales/${data.flash_sale.id}`);
        },
        onError: (error: any) => toast.error(error?.message ?? "Could not create Flash Sale"),
    });
    return (
        <Container className="p-6">
            <Heading level="h1">Create Flash Sale</Heading>
            <Text className="mb-6 text-ui-fg-subtle">
                Campaign, promotion, and schedule are saved together.
            </Text>
            <FlashSaleForm
                initial={{ weekdays: [] }}
                saving={save.isPending}
                onSubmit={(body: any) => save.mutate(body)}
                onCancel={() => navigate("/flash-sales")}
            />
        </Container>
    );
};

export default CreateFlashSalePage;
