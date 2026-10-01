import { Button, Input, Label, Select, Text, Textarea } from "@medusajs/ui";
import { FormProvider, useFieldArray, useForm, useFormContext } from "react-hook-form";
import type { ReactNode } from "react";
import {
    conditionalPromotionRuleRows,
    conditionalPromotionTargetText,
} from "./conditional-promotion-summary";

export type ConditionalForm = any;
export const blankClause = () => ({ attribute: "category", value: "" });

export const toApiMatcher = (matcher: any) => ({
    ...matcher,
    clauses: matcher.clauses.map((clause: any) => ({
        attribute: clause.attribute,
        values: clause.values ?? (clause.value ? [clause.value] : []),
    })),
});

export const toFormMatcher = (matcher: any) => ({
    ...matcher,
    clauses: matcher.clauses.map((clause: any) => ({
        attribute: clause.attribute,
        value: clause.value ?? clause.values?.[0] ?? "",
    })),
});

export const toApiConditions = (conditions: any[]) =>
    conditions.map((condition) => ({
        ...condition,
        match: toApiMatcher(condition.match),
        subset_requirements: (condition.subset_requirements ?? []).map((subset: any) => ({
            ...subset,
            match: toApiMatcher(subset.match),
        })),
    }));

export const toFormConditions = (conditions: any[]) =>
    conditions.map((condition) => ({
        ...condition,
        match: toFormMatcher(condition.match),
        subset_requirements: (condition.subset_requirements ?? []).map((subset: any) => ({
            ...subset,
            match: toFormMatcher(subset.match),
        })),
    }));

const validateMatcher = (matcher: any, label: string) => {
    if (!matcher?.clauses?.length) return `${label}: add at least one match.`;
    if (matcher.clauses.some((clause: any) => !clause.attribute || !clause.value)) {
        return `${label}: choose a value for every match.`;
    }
    return null;
};

export const validateConditionalPromotionForm = (value: any) => {
    if (!value.title?.trim()) return "Enter an internal promotion title.";
    if (!value.code?.trim()) return "Enter a promotion code.";
    if (!Number.isFinite(value.percentage) || value.percentage <= 0 || value.percentage > 100) {
        return "Discount percentage must be between 1 and 100.";
    }
    if (!Number.isInteger(value.max_quantity) || value.max_quantity < 1) {
        return "Maximum discounted quantity must be at least 1.";
    }
    if (!Number.isInteger(value.priority) || value.priority < 0)
        return "Priority must be 0 or greater.";
    if (value.cta_url) {
        try {
            new URL(value.cta_url);
        } catch {
            return "CTA URL must be a valid full URL, such as https://example.com/summer.";
        }
    }
    const targetError = validateMatcher(value.target, "Discount target");
    if (targetError) return targetError;
    if (!value.conditions?.length) return "Add at least one eligibility requirement.";
    for (let index = 0; index < value.conditions.length; index++) {
        const condition = value.conditions[index];
        const label = `Requirement ${index + 1}`;
        if (!Number.isInteger(condition.min_quantity) || condition.min_quantity < 1)
            return `${label}: minimum quantity must be at least 1.`;
        const conditionError = validateMatcher(condition.match, label);
        if (conditionError) return conditionError;
        for (const subset of condition.subset_requirements ?? []) {
            if (!Number.isInteger(subset.min_quantity) || subset.min_quantity < 1)
                return `${label}: nested minimum quantity must be at least 1.`;
            const subsetError = validateMatcher(subset.match, `${label} nested requirement`);
            if (subsetError) return subsetError;
        }
    }
    return null;
};

const attributes = ["product", "category", "collection", "tag", "type"] as const;
const attributeLabels: Record<(typeof attributes)[number], string> = {
    product: "Product",
    category: "Category",
    collection: "Collection",
    tag: "Tag",
    type: "Product type",
};

const Section = ({
    title,
    description,
    children,
}: {
    title: string;
    description: string;
    children: ReactNode;
}) => (
    <section className="rounded-xl border border-ui-border-base bg-ui-bg-base p-5 shadow-elevation-card-rest">
        <div className="mb-5">
            <h2 className="txt-large font-medium text-ui-fg-base">{title}</h2>
            <Text className="mt-1 text-ui-fg-subtle">{description}</Text>
        </div>
        {children}
    </section>
);

const Clauses = ({ name, options }: { name: string; options: Record<string, any[]> }) => {
    const { control, setValue, watch } = useFormContext<ConditionalForm>();
    const fields = useFieldArray({ control, name: `${name}.clauses` as any });
    return (
        <div className="space-y-2">
            {fields.fields.map((field, index) => {
                const path = `${name}.clauses.${index}`;
                const attribute = watch(`${path}.attribute`) || "category";
                return (
                    <div
                        className="grid grid-cols-[minmax(9rem,0.7fr)_minmax(12rem,1.5fr)_auto] gap-2"
                        key={field.id}
                    >
                        <Select
                            value={attribute}
                            onValueChange={(value) => {
                                setValue(`${path}.attribute`, value);
                                setValue(`${path}.value`, "");
                            }}
                        >
                            <Select.Trigger>
                                <Select.Value />
                            </Select.Trigger>
                            <Select.Content>
                                {attributes.map((value) => (
                                    <Select.Item key={value} value={value}>
                                        {attributeLabels[value]}
                                    </Select.Item>
                                ))}
                            </Select.Content>
                        </Select>
                        <Select
                            value={watch(`${path}.value`)}
                            onValueChange={(value) => setValue(`${path}.value`, value)}
                        >
                            <Select.Trigger>
                                <Select.Value
                                    placeholder={`Choose ${attributeLabels[attribute as keyof typeof attributeLabels].toLowerCase()}`}
                                />
                            </Select.Trigger>
                            <Select.Content>
                                {(options[attribute] ?? []).map((entry) => (
                                    <Select.Item key={entry.id} value={entry.id}>
                                        {entry.title ?? entry.name ?? entry.handle}
                                    </Select.Item>
                                ))}
                            </Select.Content>
                        </Select>
                        <Button
                            type="button"
                            size="small"
                            variant="secondary"
                            onClick={() => fields.remove(index)}
                        >
                            Remove
                        </Button>
                    </div>
                );
            })}
            <Button
                type="button"
                size="small"
                variant="secondary"
                onClick={() => fields.append(blankClause())}
            >
                Add match
            </Button>
        </div>
    );
};

const Condition = ({
    index,
    options,
    onRemove,
}: {
    index: number;
    options: Record<string, any[]>;
    onRemove: () => void;
}) => {
    const { control, register, setValue, watch } = useFormContext<ConditionalForm>();
    const subsets = useFieldArray({
        control,
        name: `conditions.${index}.subset_requirements` as any,
    });
    return (
        <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-4">
            <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                    <h3 className="txt-small-plus font-medium">Requirement {index + 1}</h3>
                    <Text className="mt-1 text-ui-fg-subtle">
                        The cart must contain this quantity of matching items.
                    </Text>
                </div>
                <Button type="button" size="small" variant="secondary" onClick={onRemove}>
                    Remove requirement
                </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <Label>Minimum quantity</Label>
                    <Input
                        className="mt-1"
                        type="number"
                        min="1"
                        {...register(`conditions.${index}.min_quantity`, { valueAsNumber: true })}
                    />
                </div>
                <div>
                    <Label>Match all or any</Label>
                    <Select
                        value={watch(`conditions.${index}.match.mode`)}
                        onValueChange={(value) => setValue(`conditions.${index}.match.mode`, value)}
                    >
                        <Select.Trigger className="mt-1">
                            <Select.Value />
                        </Select.Trigger>
                        <Select.Content>
                            <Select.Item value="all">Must match all</Select.Item>
                            <Select.Item value="any">May match any</Select.Item>
                        </Select.Content>
                    </Select>
                </div>
            </div>
            <div className="mt-3">
                <Label>Items to count</Label>
                <div className="mt-1">
                    <Clauses name={`conditions.${index}.match`} options={options} />
                </div>
            </div>
            {subsets.fields.map((field, subsetIndex) => (
                <div
                    className="mt-3 rounded-md border border-ui-border-base bg-ui-bg-base p-3"
                    key={field.id}
                >
                    <div className="mb-2 flex items-center justify-between">
                        <Label>Nested requirement</Label>
                        <Button
                            type="button"
                            size="small"
                            variant="secondary"
                            onClick={() => subsets.remove(subsetIndex)}
                        >
                            Remove
                        </Button>
                    </div>
                    <Text className="mb-3 text-ui-fg-subtle">
                        Counted only within items matched above.
                    </Text>
                    <Label>Minimum quantity</Label>
                    <Input
                        className="mb-3 mt-1"
                        type="number"
                        min="1"
                        {...register(
                            `conditions.${index}.subset_requirements.${subsetIndex}.min_quantity`,
                            { valueAsNumber: true },
                        )}
                    />
                    <Clauses
                        name={`conditions.${index}.subset_requirements.${subsetIndex}.match`}
                        options={options}
                    />
                </div>
            ))}
            <Button
                className="mt-3"
                type="button"
                size="small"
                variant="secondary"
                onClick={() =>
                    subsets.append({
                        min_quantity: 1,
                        match: { mode: "all", clauses: [blankClause()] },
                    })
                }
            >
                Add nested requirement
            </Button>
        </div>
    );
};

const RuleSummaryPanel = ({ options }: { options: Record<string, any[]> }) => {
    const { watch } = useFormContext<ConditionalForm>();
    const values = watch();
    const rows = conditionalPromotionRuleRows({ conditions: values.conditions }, options);
    const target = conditionalPromotionTargetText(values.target, options);

    return (
        <section className="rounded-xl border border-ui-border-base bg-ui-bg-base shadow-elevation-card-rest">
            <div className="border-b border-ui-border-base px-5 py-4">
                <h2 className="txt-large font-medium text-ui-fg-base">Promotion summary</h2>
                <Text className="mt-1 text-ui-fg-subtle">
                    A live overview of the benefit and cart rules.
                </Text>
            </div>
            <div className="space-y-5 p-5">
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-ui-bg-subtle p-3">
                        <Text className="text-ui-fg-subtle">Discount</Text>
                        <p className="mt-1 text-xl font-semibold text-ui-fg-base">
                            {values.percentage ?? 0}% off
                        </p>
                    </div>
                    <div className="rounded-lg bg-ui-bg-subtle p-3">
                        <Text className="text-ui-fg-subtle">Maximum</Text>
                        <p className="mt-1 text-xl font-semibold text-ui-fg-base">
                            {values.max_quantity ?? 0} item{values.max_quantity === 1 ? "" : "s"}
                        </p>
                    </div>
                </div>
                <div>
                    <Text className="txt-small-plus text-ui-fg-base">Discounted items</Text>
                    <Text className="mt-1 text-ui-fg-subtle">{target}</Text>
                </div>
                <div>
                    <Text className="txt-small-plus text-ui-fg-base">Eligibility requirements</Text>
                    <div className="mt-3 overflow-hidden rounded-lg border border-ui-border-base">
                        <table className="w-full table-fixed text-left">
                            <thead className="bg-ui-bg-subtle text-ui-fg-subtle">
                                <tr>
                                    <th className="w-12 px-3 py-2 text-xs font-medium">#</th>
                                    <th className="w-20 px-3 py-2 text-xs font-medium">Min.</th>
                                    <th className="px-3 py-2 text-xs font-medium">
                                        Cart must contain
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length ? (
                                    rows.map((row) => (
                                        <tr
                                            className="border-t border-ui-border-base align-top"
                                            key={row.id}
                                        >
                                            <td className="px-3 py-3 text-ui-fg-subtle">
                                                {row.id}
                                            </td>
                                            <td className="px-3 py-3">
                                                <span className="inline-flex min-w-6 justify-center rounded bg-ui-bg-interactive px-1.5 py-0.5 text-xs font-semibold text-ui-fg-on-color">
                                                    {row.minimumQuantity}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3">
                                                <Text className="text-ui-fg-base">
                                                    {row.matcher}
                                                </Text>
                                                {row.nested.map((nested, index) => (
                                                    <div
                                                        className="mt-2 rounded-md border-l-2 border-ui-border-interactive bg-ui-bg-subtle px-2 py-1.5"
                                                        key={index}
                                                    >
                                                        <Text className="text-ui-fg-subtle">
                                                            <span className="font-medium text-ui-fg-base">
                                                                Then {nested.minimumQuantity}+
                                                            </span>{" "}
                                                            {nested.matcher}
                                                        </Text>
                                                    </div>
                                                ))}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td className="px-3 py-4 text-ui-fg-subtle" colSpan={3}>
                                            Add an eligibility requirement to preview it here.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </section>
    );
};

export const ConditionalPromotionForm = ({
    initial,
    options,
    onSubmit,
    onCancel,
    onValidationError,
    sidebarFooter,
    isSaving,
    submitLabel = "Save promotion",
}: any) => {
    const form = useForm({ defaultValues: initial });
    const conditions = useFieldArray({ control: form.control, name: "conditions" });
    const handleSubmit = (value: any) => {
        const error = validateConditionalPromotionForm(value);
        if (error) {
            onValidationError?.(error);
            return;
        }
        onSubmit(value);
    };
    return (
        <FormProvider {...form}>
            <form
                className="mx-auto grid max-w-7xl grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]"
                onSubmit={form.handleSubmit(handleSubmit)}
            >
                <div className="min-w-0 space-y-5">
                    <Section
                        title="Promotion details"
                        description="Give the automatic benefit a clear internal name and configure its customer-facing value."
                    >
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Internal title</Label>
                                <Input
                                    className="mt-1"
                                    {...form.register("title", { required: true })}
                                    placeholder="e.g. Summer racket gift"
                                />
                            </div>
                            <div>
                                <Label>Promotion code</Label>
                                <Input
                                    className="mt-1"
                                    {...form.register("code", { required: true })}
                                    placeholder="e.g. RACKET_SUMMER_GET_SOCK"
                                />
                            </div>
                            <div>
                                <Label>Discount percentage</Label>
                                <Input
                                    className="mt-1"
                                    type="number"
                                    min="1"
                                    max="100"
                                    {...form.register("percentage", { valueAsNumber: true })}
                                    placeholder="100"
                                />
                            </div>
                            <div>
                                <Label>Maximum discounted quantity</Label>
                                <Input
                                    className="mt-1"
                                    type="number"
                                    min="1"
                                    {...form.register("max_quantity", { valueAsNumber: true })}
                                    placeholder="1"
                                />
                            </div>
                            <div>
                                <Label>Priority</Label>
                                <Input
                                    className="mt-1"
                                    type="number"
                                    min="0"
                                    {...form.register("priority", { valueAsNumber: true })}
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <Label>CTA URL (optional)</Label>
                                <Input
                                    className="mt-1"
                                    {...form.register("cta_url")}
                                    placeholder="https://example.com/summer"
                                />
                            </div>
                        </div>
                        <div className="mt-4">
                            <Label>Customer-facing description</Label>
                            <Textarea
                                className="mt-1"
                                {...form.register("description")}
                                placeholder="Explain when this automatic benefit applies."
                            />
                        </div>
                        <div className="mt-4">
                            <Label>Terms (optional)</Label>
                            <Textarea
                                className="mt-1"
                                {...form.register("terms")}
                                placeholder="e.g. Free one eligible Socks item while stock lasts."
                            />
                        </div>
                    </Section>
                    <Section
                        title="Discount target"
                        description="Choose which cart item can receive the discount. The maximum quantity above limits discounted units."
                    >
                        <Label>Eligible discounted item</Label>
                        <div className="mt-1">
                            <Clauses name="target" options={options} />
                        </div>
                    </Section>
                    <Section
                        title="Eligibility rules"
                        description="All requirements must pass. Quantity is the sum of matching line-item quantities, including two units of the same variant."
                    >
                        <div className="space-y-3">
                            {conditions.fields.map((field, index) => (
                                <Condition
                                    key={field.id}
                                    index={index}
                                    options={options}
                                    onRemove={() => conditions.remove(index)}
                                />
                            ))}
                        </div>
                        <Button
                            className="mt-4"
                            type="button"
                            variant="secondary"
                            onClick={() =>
                                conditions.append({
                                    min_quantity: 1,
                                    match: { mode: "all", clauses: [blankClause()] },
                                    subset_requirements: [],
                                })
                            }
                        >
                            Add eligibility requirement
                        </Button>
                    </Section>
                    <div className="flex items-center justify-end gap-2 pb-8">
                        <Button type="button" variant="secondary" onClick={onCancel}>
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isSaving}>
                            {submitLabel}
                        </Button>
                    </div>
                </div>
                <aside className="sticky top-0 self-start space-y-4">
                    <RuleSummaryPanel options={options} />
                    {sidebarFooter}
                </aside>
            </form>
        </FormProvider>
    );
};
