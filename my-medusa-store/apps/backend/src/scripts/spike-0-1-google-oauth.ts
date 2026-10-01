import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

export default async function spike01GoogleOAuth({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const authModule = container.resolve(Modules.AUTH);

  logger.info("=== SPIKE 0.1: TESTING GOOGLE OAUTH PROVIDER INITIALIZATION ===");

  try {
    const callbackUrl = "http://localhost:8000/api/auth/callback/google";
    const authData = {
      url: "/auth/customer/google",
      headers: {},
      query: {},
      body: { callback_url: callbackUrl },
      protocol: "http",
    };

    logger.info(`Calling authModule.authenticate('google') with callback_url: ${callbackUrl}`);
    const result = await (authModule as any).authenticate("google", authData);

    logger.info(`Auth result success: ${result.success}`);
    if (result.location) {
      logger.info(`Generated Google Auth Location: ${result.location}`);
      const parsedUrl = new URL(result.location);
      logger.info(`Redirect URI: ${parsedUrl.searchParams.get("redirect_uri")}`);
      logger.info(`Client ID: ${parsedUrl.searchParams.get("client_id")}`);
      logger.info(`Scope: ${parsedUrl.searchParams.get("scope")}`);
      logger.info(`State parameter present: ${Boolean(parsedUrl.searchParams.get("state"))}`);

      console.log("\n[SPIKE 0.1 SUCCESS] Google OAuth Provider is fully operational on Medusa v2.21!");
      console.log("Generated Auth URL:\n" + result.location + "\n");
    } else {
      logger.error(`Failed to generate Google Auth URL. Result: ${JSON.stringify(result)}`);
    }
  } catch (error: any) {
    logger.error(`Spike 0.1 Error: ${error.message}`);
    throw error;
  }
}
