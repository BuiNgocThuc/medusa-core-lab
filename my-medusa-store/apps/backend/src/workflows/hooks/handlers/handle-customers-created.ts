import { StepExecutionContext, StepResponse } from "@medusajs/framework/workflows-sdk";
import { CustomerDTO } from "@medusajs/framework/types";
import { MedusaError, Modules } from "@medusajs/framework/utils";
import {
  customerAdditionalDataSchema,
  CustomerAdditionalData,
} from "../../../utils/customer-additional-data";

export interface CustomersCreatedHookInput {
  customers: CustomerDTO[];
  additional_data?: Record<string, unknown>;
}

// Handler for customersCreated workflow hook | Xử lý hook customersCreated
// Đồng bộ additional_data (zalo_id, avatar_url) vào metadata của customer vừa tạo
// Synchronizes validated additional_data into created customer metadata
export async function handleCustomersCreated(
  input: CustomersCreatedHookInput,
  context: StepExecutionContext
): Promise<StepResponse<void>> {

  const parseResult = customerAdditionalDataSchema.safeParse(input.additional_data);

  if (!parseResult.success) {

    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Invalid customer additional data: ${parseResult.error.message}`
    );

  }

  const extraData: CustomerAdditionalData = parseResult.data;
  const hasTask3Fields = extraData.zalo_id !== undefined || extraData.avatar_url !== undefined;

  if (!hasTask3Fields) {

    return new StepResponse();

  }

  if (input.customers.length !== 1) {

    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Customer additional data (zalo_id, avatar_url) can only be applied to exactly 1 customer, but received ${input.customers.length}`
    );

  }

  const customerModuleService = context.container.resolve(Modules.CUSTOMER);
  const customer = input.customers[0];

  await customerModuleService.updateCustomers(customer.id, {
    metadata: extraData,
  });

  return new StepResponse();

}