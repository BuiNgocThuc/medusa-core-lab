import { Button, Input, Label, Select, Text } from "@medusajs/ui";
import { useForm } from "react-hook-form";

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const FlashSaleForm = ({ initial, saving, onSubmit, onCancel }: any) => {
    const { register, handleSubmit, watch, setValue } = useForm({ defaultValues: initial ?? { weekdays: [] } });
    const weekdays = (watch("weekdays") ?? []) as number[];
    const toggleDay = (day: number) =>
        setValue(
            "weekdays",
            weekdays.includes(day) ? weekdays.filter((entry) => entry !== day) : [...weekdays, day],
        );
    return (
        <form className="mx-auto grid max-w-5xl gap-5 pb-12" onSubmit={handleSubmit(onSubmit)}>
            <section className="rounded-xl border border-ui-border-base bg-ui-bg-base p-5">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h2 className="txt-large font-medium">Campaign</h2>
                        <Text className="text-ui-fg-subtle">
                            Status is determined automatically from the campaign and schedule time.
                        </Text>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label>Name</Label>
                        <Input className="mt-1" placeholder="Flash Sale 11.11" {...register("campaign.name")} />
                    </div>
                    <div>
                        <Label>Identifier</Label>
                        <Input className="mt-1" placeholder="FLASH_1111" {...register("campaign.campaign_identifier")} />
                    </div>
                    <div>
                        <Label>Starts at</Label>
                        <Input
                            className="mt-1"
                            type="datetime-local"
                            {...register("campaign.starts_at")}
                        />
                    </div>
                    <div>
                        <Label>Ends at</Label>
                        <Input
                            className="mt-1"
                            type="datetime-local"
                            {...register("campaign.ends_at")}
                        />
                    </div>
                    <div>
                        <Label>Budget type</Label>
                        <Select
                            value={watch("campaign.budget_type")}
                            onValueChange={(value) => setValue("campaign.budget_type", value)}
                        >
                            <Select.Trigger className="mt-1">
                                <Select.Value placeholder="Choose budget type" />
                            </Select.Trigger>
                            <Select.Content>
                                <Select.Item value="spend">Spend (VND)</Select.Item>
                                <Select.Item value="usage">Usage (claims)</Select.Item>
                            </Select.Content>
                        </Select>
                    </div>
                    <div>
                        <Label>
                            {watch("campaign.budget_type") === "usage"
                                ? "Usage limit"
                                : "Spend budget (VND)"}
                        </Label>
                        <Input
                            className="mt-1"
                            type="number"
                            placeholder={watch("campaign.budget_type") === "usage" ? "100" : "20000000"}
                            {...register("campaign.budget_limit", { valueAsNumber: true })}
                        />
                    </div>
                    <div>
                        <Label>Uses per customer</Label>
                        <Input
                            className="mt-1"
                            type="number"
                            min="1"
                            placeholder="2"
                            {...register("campaign.usage_limit", { valueAsNumber: true })}
                        />
                    </div>
                </div>
            </section>
            <section className="rounded-xl border border-ui-border-base bg-ui-bg-base p-5">
                <h2 className="txt-large font-medium">Promotion</h2>
                <Text className="mb-4 text-ui-fg-subtle">
                    Percentage order discount, managed by Promotion Module.
                </Text>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label>Promotion code</Label>
                        <Input className="mt-1" placeholder="FLASH20" {...register("promotion.code")} />
                    </div>
                    <div>
                        <Label>Discount percentage</Label>
                        <Input
                            className="mt-1"
                            type="number"
                            min="1"
                            max="100"
                            placeholder="20"
                            {...register("promotion.percentage", { valueAsNumber: true })}
                        />
                    </div>
                </div>
            </section>
            <section className="rounded-xl border border-ui-border-base bg-ui-bg-base p-5">
                <h2 className="txt-large font-medium">Flash Sale schedule</h2>
                <Text className="mb-4 text-ui-fg-subtle">
                    Recurring schedule and cap not available in native promotions.
                </Text>
                <div className="grid grid-cols-3 gap-3">
                    <div>
                        <Label>Timezone</Label>
                        <Input className="mt-1" placeholder="Asia/Ho_Chi_Minh" {...register("timezone")} />
                    </div>
                    <div>
                        <Label>Start time</Label>
                        <Input className="mt-1" type="time" placeholder="16:00" {...register("start_time")} />
                    </div>
                    <div>
                        <Label>End time</Label>
                        <Input className="mt-1" type="time" placeholder="18:00" {...register("end_time")} />
                    </div>
                    <div>
                        <Label>Maximum discount (VND)</Label>
                        <Input
                            className="mt-1"
                            type="number"
                            placeholder="300000"
                            {...register("max_discount_amount", { valueAsNumber: true })}
                        />
                    </div>
                </div>
                <div className="mt-4">
                    <Label>Repeats on</Label>
                    <div className="mt-2 flex gap-2">
                        {days.map((label, index) => (
                            <Button
                                key={label}
                                type="button"
                                size="small"
                                variant={weekdays.includes(index) ? "primary" : "secondary"}
                                onClick={() => toggleDay(index)}
                            >
                                {label}
                            </Button>
                        ))}
                    </div>
                </div>
            </section>
            <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={onCancel}>
                    Cancel
                </Button>
                <Button type="submit" isLoading={saving}>
                    Save Flash Sale
                </Button>
            </div>
        </form>
    );
};
