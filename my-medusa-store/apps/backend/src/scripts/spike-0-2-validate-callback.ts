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

export default async function spike02ValidateCallback({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const authModule = container.resolve(Modules.AUTH);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  logger.info("=== SPIKE 0.2 & 0.3: TOKEN EXCHANGE & JWT / DB STRUCTURE VERIFICATION ===");

  // Support both: npx medusa exec ... <url> AND npx medusa exec ... -- <url>
  const rawInput = args?.find((arg) => arg !== "--" && arg.length > 0);
  if (!rawInput) {
    console.error("\n[ERROR] Vui long cung cap callback URL tu trinh duyet.");
    console.error("Cu phap mau:");
    console.error("  npx medusa exec ./src/scripts/spike-0-2-validate-callback.ts 'http://localhost:8000/api/auth/callback/google?state=...&code=...'\n");
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Thieu tham so callback URL"
    );
  }

  let code = "";
  let state = "";

  try {
    if (rawInput.startsWith("http")) {
      const parsedUrl = new URL(rawInput);
      code = parsedUrl.searchParams.get("code") || "";
      state = parsedUrl.searchParams.get("state") || "";
    } else if (rawInput.includes("code=")) {
      const searchParams = new URLSearchParams(rawInput);
      code = searchParams.get("code") || "";
      state = searchParams.get("state") || "";
    } else {
      code = rawInput;
    }
  } catch (err: any) {
    logger.error(`Khong the phan tich input: ${err.message}`);
    throw err;
  }

  if (!code) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Khong tim thay tham so 'code' trong URL");
  }

  logger.info(`Extracted Code: ${code.substring(0, 15)}...`);
  logger.info(`Extracted State: ${state}`);

  // Dam bao state ton tai trong cache truoc khi validateCallback (phuc vu chay script CLI rieng le giua cac process)
  const authIdentityService = (authModule as any).getAuthIdentityProviderService("google");
  await authIdentityService.setState(state, {
    callback_url: "http://localhost:8000/api/auth/callback/google",
  });

  const authData = {
    url: `/auth/customer/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
    headers: {},
    query: { code, state },
    body: { code, state },
    protocol: "http",
  };

  logger.info("Goi validateCallback('google') de doi code lay Google ID Token...");
  const callbackResponse = await (authModule as any).validateCallback("google", authData);

  if (!callbackResponse.success || !callbackResponse.authIdentity) {
    logger.error(`validateCallback that bai: ${callbackResponse.error || "Unknown error"}`);
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      `Xac thuc that bai: ${callbackResponse.error}`
    );
  }

  const authIdentity = callbackResponse.authIdentity;
  logger.info(`Xac thuc Google thanh cong! Auth Identity ID: ${authIdentity.id}`);

  logger.info("Sinh JWT token voi actorType='customer'...");
  const jwtResult = await generateJwtTokenWithChecks(container, {
    authIdentity,
    mfaChallenge: callbackResponse.mfaChallenge,
    actorType: "customer",
    authProvider: "google",
  });

  const token = jwtResult.token;
  const decoded = decodeJwt(token);

  console.log("\n============================================================");
  console.log("=== SPIKE 0.2: DECODED JWT TOKEN PAYLOAD ===");
  console.log("============================================================");
  console.log(JSON.stringify(decoded, null, 2));

  console.log("\n=== PHAN TICH CHI TIET JWT (SPIKE 0.2 VERIFICATION) ===");
  console.log(`- actor_id: "${decoded.actor_id}" (Kieu du lieu: ${typeof decoded.actor_id})`);
  console.log(`- Is Actorless Token: ${decoded.actor_id === "" ? "DUNG (Chuoi rong '')" : "SAI"}`);
  console.log(`- actor_type: "${decoded.actor_type}"`);
  console.log(`- auth_identity_id: "${decoded.auth_identity_id}"`);
  console.log(`- user_metadata.email: "${decoded.user_metadata?.email}"`);
  console.log(`- user_metadata.name: "${decoded.user_metadata?.name}"`);

  console.log("\n============================================================");
  console.log("=== SPIKE 0.3: KIEM TRA POSTGRESQL IDENTITY RECORDS ===");
  console.log("============================================================");
  try {
    const { data: authIdentities } = await query.graph({
      entity: "auth_identity",
      fields: ["id", "app_metadata", "provider_identities.*"],
      filters: { id: authIdentity.id },
    });

    console.log("Bang auth_identity & provider_identity:");
    console.log(JSON.stringify(authIdentities, null, 2));
    console.log("\n[SPIKE 0.2 & 0.3 HOAN TAT XUAT SAC]");
  } catch (err: any) {
    logger.warn(`Query graph error: ${err.message}. Lay thong tin tu authIdentity object:`);
    console.log(JSON.stringify(authIdentity, null, 2));
  }
}
