import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

export async function authAuditMiddleware(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const body = (req.body || {}) as Record<string, any>
  const username = body.email || body.identifier || body.username || "unknown"

  res.on("finish", () => {
    const status = res.statusCode === 200 ? "SUCCESS" : "FAILED"
    console.log(`[Auth] ${username} -> ${status}`)
  })

  next()
}
