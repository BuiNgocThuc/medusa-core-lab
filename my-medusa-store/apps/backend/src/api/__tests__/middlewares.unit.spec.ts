import { adminCreateCustomerAdditionalDataValidator } from "../middlewares";
import { z } from "@medusajs/framework/zod";

describe("Admin Customer additionalDataValidator Schema", () => {

  const schema = z.object(adminCreateCustomerAdditionalDataValidator);

  describe("zalo_id validation", () => {

    it("should accept valid numeric strings (8 to 20 digits)", () => {

      expect(schema.safeParse({ zalo_id: "12345678" }).success).toBe(true);

      expect(schema.safeParse({ zalo_id: "12345678901234567890" }).success).toBe(true);

    });

    it("should reject non-numeric, too short, too long or empty string", () => {

      expect(schema.safeParse({ zalo_id: "1234567" }).success).toBe(false);

      expect(schema.safeParse({ zalo_id: "123456789012345678901" }).success).toBe(false);

      expect(schema.safeParse({ zalo_id: "abc12345" }).success).toBe(false);

      expect(schema.safeParse({ zalo_id: "" }).success).toBe(false);

    });

    it("should reject null value (.optional() allows undefined, not null)", () => {

      expect(schema.safeParse({ zalo_id: null }).success).toBe(false);

    });

  });

  describe("avatar_url validation", () => {

    it("should accept valid http/https URLs", () => {

      expect(schema.safeParse({ avatar_url: "https://example.com/a.png" }).success).toBe(true);

      expect(schema.safeParse({ avatar_url: "http://example.com/a.png" }).success).toBe(true);

    });

    it("should reject invalid protocols (ftp, file, javascript)", () => {

      expect(schema.safeParse({ avatar_url: "ftp://example.com/a.png" }).success).toBe(false);

      expect(schema.safeParse({ avatar_url: "javascript:alert(1)" }).success).toBe(false);

      expect(schema.safeParse({ avatar_url: "not-a-url" }).success).toBe(false);

    });

    it("should reject null value (.optional() allows undefined, not null)", () => {

      expect(schema.safeParse({ avatar_url: null }).success).toBe(false);

    });

  });

  describe("unknown fields stripping behavior", () => {

    it("should strictly strip unrecognized keys from transformed output", () => {

      const result = schema.parse({
        zalo_id: "12345678",
        unknown_field: "should_be_stripped",
      });

      expect((result as any).unknown_field).toBeUndefined();

      expect(result.zalo_id).toBe("12345678");

    });

  });

});
