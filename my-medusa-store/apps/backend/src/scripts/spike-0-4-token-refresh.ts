import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils";
import { generateJwtTokenWithChecks } from "@medusajs/medusa/api/auth/utils/generate-jwt-token";

/**
 * Giai ma JWT payload bang Node.js Buffer native (Base64URL)
 * Native Base64URL JWT payload decoder without external dependencies
 */
function decodeJwt(token: string): Record<string, any> {
  const parts = token.split(".");
  if (parts.length < 2) {
    return {};
  }

  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return {};
  }
}

export default async function spike04TokenRefresh({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const authModule = container.resolve(Modules.AUTH);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  logger.info("=== SPIKE 0.4: RUNTIME METADATA UPDATE & JWT REFRESH VERIFICATION ===");

  const authIdentityId = args?.[0] || "authid_01M3V7EXDBQFTFPBZ0NFTWHDFD";
  const customerId = args?.[1] || "cus_01M3K348H0FXQ29S9YQ35KYY3V";

  logger.info(`Target Auth Identity: ${authIdentityId}`);
  logger.info(`Target Customer ID: ${customerId}`);

  // 1. Kiem tra trang thai truoc khi update
  logger.info("Step 1: Kiem tra du lieu auth_identity truoc khi update...");
  const authIdentityBefore = await (authModule as any).retrieveAuthIdentity(authIdentityId);
  logger.info(`app_metadata truoc update: ${JSON.stringify(authIdentityBefore.app_metadata)}`);

  // 2. Cap nhat app_metadata.customer_id
  logger.info("Step 2: Tien hanh cap nhat app_metadata.customer_id...");
  const updatedAuthIdentity = await (authModule as any).updateAuthIdentities({
    id: authIdentityId,
    app_metadata: {
      ...(authIdentityBefore.app_metadata || {}),
      customer_id: customerId,
    },
  });

  // 3. Kiem tra lai co so du lieu PostgreSQL
  logger.info("Step 3: Doi soat truc tiep database PostgreSQL sau update...");
  const { data: dbCheck } = await query.graph({
    entity: "auth_identity",
    fields: ["id", "app_metadata", "provider_identities.*"],
    filters: { id: authIdentityId },
  });

  console.log("\n[DATABASE VERIFICATION - POSTGRESQL]");
  console.log(JSON.stringify(dbCheck, null, 2));

  // 4. Sinh JWT token moi (mo phong chinh xac luong POST /auth/token/refresh)
  logger.info("Step 4: Sinh token moi sau khi lien ket (generateJwtTokenWithChecks)...");
  const jwtResult = await generateJwtTokenWithChecks(container, {
    authIdentity: updatedAuthIdentity,
    actorType: "customer",
    authProvider: "google",
  });

  const token = jwtResult.token;
  const decoded = decodeJwt(token);

  console.log("\n============================================================");
  console.log("=== SPIKE 0.4: DECODED REFRESHED JWT TOKEN PAYLOAD ===");
  console.log("============================================================");
  console.log(JSON.stringify(decoded, null, 2));

  // 5. Kiem tra Acceptance Gate theo tieu chuan nghiem ngat
  console.log("\n============================================================");
  console.log("=== ACCEPTANCE GATE EVALUATION (DIEU KIEN TIEN QUYET) ===");
  console.log("============================================================");
  console.log(`- Expected actor_id: "${customerId}"`);
  console.log(`- Actual actor_id:   "${decoded.actor_id}"`);
  console.log(`- Expected actor_type: "customer"`);
  console.log(`- Actual actor_type:   "${decoded.actor_type}"`);

  const passed =
    decoded.actor_id === customerId &&
    decoded.actor_type === "customer" &&
    decoded.app_metadata?.customer_id === customerId;

  if (passed) {
    console.log("\n>>> [KET QUA: ACCEPTANCE GATE PASSED 100%] <<<");
    console.log("1. Medusa Core da tu dong chuyen actorless token thanh Full-Actor JWT.");
    console.log("2. Khach hang Google da duoc lien ket thanh cong vao Customer.");
    console.log("3. San sang 100% de bat tay implement Phase 1 Backend Core!\n");
  } else {
    console.error("\n>>> [KET QUA: ACCEPTANCE GATE FAILED] <<<");
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "actor_id khong khop voi customer_id ky vong sau refresh!"
    );
  }
}
