import { CustomerDTO } from "@medusajs/framework/types";
import { createStep } from "@medusajs/framework/workflows-sdk";
import { MedusaError } from "@medusajs/framework/utils";

export type ValidateCustomerExistsStepInput = {
    customer: CustomerDTO | null | undefined;
};

const VALIDATE_CUSTOMER_EXIST_STEP_ID = "validate-customer-exists";

export const validateCustomerExistsStep = createStep(
    VALIDATE_CUSTOMER_EXIST_STEP_ID,
    async ({ customer }: ValidateCustomerExistsStepInput) => {
        if (!customer) {
            throw new MedusaError(MedusaError.Types.INVALID_DATA, "Customer not found");
        }

        if (!customer.has_account) {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "Customer must have an account to earn or manage points",
            );
        }
    },
);
