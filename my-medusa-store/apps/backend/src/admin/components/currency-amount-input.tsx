import { Input } from "@medusajs/ui";
import { useEffect, useState } from "react";

export const formatCurrencyAmount = (value: number) =>
    new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value);

type CurrencyAmountInputProps = {
    value: number;
    onValueChange: (value: number) => void;
};

export const CurrencyAmountInput = ({ value, onValueChange }: CurrencyAmountInputProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [inputValue, setInputValue] = useState(formatCurrencyAmount(value));

    useEffect(() => {
        if (!isEditing) {
            setInputValue(formatCurrencyAmount(value));
        }
    }, [isEditing, value]);

    return (
        <Input
            inputMode="numeric"
            placeholder="0"
            value={inputValue}
            onFocus={() => {
                setIsEditing(true);
                setInputValue(value === 0 ? "" : String(value));
            }}
            onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, "");
                setInputValue(digits);

                if (digits) {
                    onValueChange(Number(digits));
                }
            }}
            onBlur={() => {
                const nextValue = Number(inputValue || 0);
                onValueChange(nextValue);
                setInputValue(formatCurrencyAmount(nextValue));
                setIsEditing(false);
            }}
        />
    );
};
