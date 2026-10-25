import { createCustomersWorkflow } from "@medusajs/medusa/core-flows";
import { handleCustomersCreated } from "./handlers/handle-customers-created";

createCustomersWorkflow.hooks.customersCreated(handleCustomersCreated);