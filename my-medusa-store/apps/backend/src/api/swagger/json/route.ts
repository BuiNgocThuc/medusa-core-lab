import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

import { buildOpenApiDocument } from "@/src/utils/openapi";

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
    res.status(200).json(buildOpenApiDocument());
}
