import { CustomerDTO, type ICustomerModuleService } from "@medusajs/framework/types";
import { StepExecutionContext, StepResponse } from "@medusajs/framework/workflows-sdk";
import { MedusaError, Modules } from "@medusajs/framework/utils";
import {
  customerAdditionalDataSchema,
  type CustomerAdditionalData,
} from "../../../utils/customer-additional-data";

export interface CustomersCreatedHookInput {
  customers: CustomerDTO[];
  additional_data?: Record<string, unknown>;
}

export async function handleCustomersCreated(
  { customers, additional_data }: CustomersCreatedHookInput,
  { container }: StepExecutionContext
): Promise<StepResponse<void>> {
  if (!additional_data || typeof additional_data !== "object") {
    return new StepResponse();
  }

  const parseResult = customerAdditionalDataSchema.safeParse(additional_data);

  if (!parseResult.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Invalid Task 3 customer additional data."
    );
  }

  const { zalo_id, avatar_url } = parseResult.data;

  const hasTask3Fields = zalo_id !== undefined || avatar_url !== undefined;

  if (!hasTask3Fields) {
    return new StepResponse();
  }

  if (customers.length !== 1) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Cannot assign single-customer additional_data to ${customers.length} customers in batch.`
    );
  }

  const extraData: CustomerAdditionalData = {};

  if (zalo_id !== undefined) {
    extraData.zalo_id = zalo_id;
  }

  if (avatar_url !== undefined) {
    extraData.avatar_url = avatar_url;
  }

  const customerModuleService: ICustomerModuleService =
    container.resolve(Modules.CUSTOMER);

  await customerModuleService.updateCustomers(customers[0].id, {
    metadata: extraData,
  });

  return new StepResponse();
}
