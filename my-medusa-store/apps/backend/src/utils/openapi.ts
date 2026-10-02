import fs from "node:fs";
import path from "node:path";

type HttpMethod =
    | "get"
    | "post"
    | "put"
    | "patch"
    | "delete"
    | "options"
    | "head";

type OpenApiSchema = Record<string, unknown>;

const HTTP_METHODS = [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
    "HEAD",
] as const;

const API_ROOT = path.join(process.cwd(), "src", "api");
const DEFAULT_JSON_RESPONSE = {
    description: "Successful response",
    content: {
        "application/json": {
            schema: {
                type: "object",
                additionalProperties: true,
            },
        },
    },
};

const REQUEST_BODIES: Record<string, OpenApiSchema> = {
    "POST /admin/tiers": {
        type: "object",
        required: ["name", "promo_id", "tier_rules"],
        properties: {
            name: { type: "string", example: "Silver" },
            promo_id: {
                type: "string",
                nullable: true,
                example: "promo_01HZX...",
            },
            tier_rules: {
                type: "array",
                minItems: 1,
                items: { $ref: "#/components/schemas/TierRuleInput" },
            },
        },
    },
    "POST /admin/tiers/{id}": {
        type: "object",
        required: ["name", "promo_id", "tier_rules"],
        properties: {
            name: { type: "string", example: "Gold" },
            promo_id: {
                type: "string",
                nullable: true,
                example: "promo_01HZX...",
            },
            tier_rules: {
                type: "array",
                minItems: 1,
                items: { $ref: "#/components/schemas/TierRuleInput" },
            },
        },
    },
    "POST /store/carts/{id}/loyalty-points": {
        type: "object",
        required: ["points"],
        properties: {
            points: {
                type: "integer",
                minimum: 1,
                example: 200,
            },
        },
    },
};

const QUERY_PARAMETERS: Record<string, OpenApiSchema[]> = {
    "GET /admin/momo-refunds": [
        {
            name: "payment_session_id",
            in: "query",
            required: true,
            schema: { type: "string" },
            example: "payses_01HZX...",
        },
    ],
    "GET /admin/vnpay-refunds": [
        {
            name: "payment_session_id",
            in: "query",
            required: true,
            schema: { type: "string" },
            example: "payses_01HZX...",
        },
    ],
    "GET /store/customers/me/next-tier": [
        {
            name: "region_id",
            in: "query",
            required: true,
            schema: { type: "string" },
            example: "reg_01HZX...",
        },
    ],
};

const VN_PAY_QUERY_FIELDS = [
    "vnp_TmnCode",
    "vnp_Amount",
    "vnp_BankCode",
    "vnp_BankTranNo",
    "vnp_CardType",
    "vnp_OrderInfo",
    "vnp_PayDate",
    "vnp_ResponseCode",
    "vnp_TxnRef",
    "vnp_TransactionNo",
    "vnp_TransactionStatus",
    "vnp_SecureHash",
];

QUERY_PARAMETERS["GET /hooks/payment/vnpay"] = VN_PAY_QUERY_FIELDS.map(
    (name) => ({
        name,
        in: "query",
        required: ["vnp_TmnCode", "vnp_TxnRef", "vnp_SecureHash"].includes(
            name
        ),
        schema: { type: "string" },
    })
);

export function buildOpenApiDocument() {
    const paths: Record<string, Record<string, unknown>> = {};

    for (const route of discoverApiRoutes()) {
        paths[route.openapiPath] = paths[route.openapiPath] || {};

        for (const method of route.methods) {
            const operationKey = `${method.toUpperCase()} ${route.openapiPath}`;
            paths[route.openapiPath][method] = buildOperation({
                method,
                operationKey,
                routePath: route.openapiPath,
            });
        }
    }

    return {
        openapi: "3.0.3",
        info: {
            title: "Medusa Core Lab API",
            version: "1.0.0",
            description:
                "Auto-generated from apps/backend/src/api route files. Use Authorize for admin/customer bearer tokens or publishable API key before trying protected endpoints.",
        },
        servers: [
            {
                url: "/",
                description: "Current Medusa backend",
            },
        ],
        tags: [
            { name: "admin", description: "Admin APIs" },
            { name: "store", description: "Storefront APIs" },
            { name: "hooks", description: "Webhook/payment callback APIs" },
            { name: "docs", description: "Swagger/OpenAPI endpoints" },
        ],
        paths,
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                    description:
                        "Admin or customer JWT/session bearer token, depending on endpoint.",
                },
                publishableApiKey: {
                    type: "apiKey",
                    in: "header",
                    name: "x-publishable-api-key",
                    description: "Medusa publishable API key for store APIs.",
                },
            },
            schemas: {
                TierRuleInput: {
                    type: "object",
                    required: ["min_purchase_value", "currency_code"],
                    properties: {
                        min_purchase_value: {
                            type: "number",
                            minimum: 0,
                            example: 2000000,
                        },
                        currency_code: {
                            type: "string",
                            minLength: 3,
                            maxLength: 3,
                            example: "vnd",
                        },
                    },
                },
            },
        },
    };
}

function buildOperation({
    method,
    operationKey,
    routePath,
}: {
    method: HttpMethod;
    operationKey: string;
    routePath: string;
}) {
    const pathParameters = Array.from(routePath.matchAll(/\{([^}]+)\}/g)).map(
        ([, name]) => ({
            name,
            in: "path",
            required: true,
            schema: { type: "string" },
        })
    );
    const queryParameters = QUERY_PARAMETERS[operationKey] || [];
    const requestBodySchema = REQUEST_BODIES[operationKey];

    return {
        tags: [tagForPath(routePath)],
        summary: humanizeOperation(method, routePath),
        operationId: operationId(method, routePath),
        parameters: [...pathParameters, ...queryParameters],
        ...(requestBodySchema
            ? {
                  requestBody: {
                      required: true,
                      content: {
                          "application/json": {
                              schema: requestBodySchema,
                          },
                      },
                  },
              }
            : {}),
        security: securityForPath(routePath),
        responses: {
            "200": DEFAULT_JSON_RESPONSE,
            "400": { description: "Bad request" },
            "401": { description: "Unauthorized" },
            "404": { description: "Not found" },
            "500": { description: "Internal server error" },
        },
    };
}

function discoverApiRoutes() {
    if (!fs.existsSync(API_ROOT)) {
        return [];
    }

    return walk(API_ROOT)
        .filter((filePath) => filePath.endsWith(`${path.sep}route.ts`))
        .map((filePath) => {
            const source = fs.readFileSync(filePath, "utf8");
            return {
                openapiPath: toOpenApiPath(filePath),
                methods: exportedMethods(source),
            };
        })
        .filter((route) => route.methods.length > 0)
        .sort((a, b) => a.openapiPath.localeCompare(b.openapiPath));
}

function walk(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            if (entry.name === "__tests__") {
                return [];
            }

            return walk(entryPath);
        }

        return [entryPath];
    });
}

function exportedMethods(source: string): HttpMethod[] {
    return HTTP_METHODS.filter((method) => {
        const patterns = [
            new RegExp(`export\\s+async\\s+function\\s+${method}\\b`),
            new RegExp(`export\\s+function\\s+${method}\\b`),
            new RegExp(`export\\s+const\\s+${method}\\b`),
        ];

        return patterns.some((pattern) => pattern.test(source));
    }).map((method) => method.toLowerCase() as HttpMethod);
}

function toOpenApiPath(filePath: string) {
    const relativeDir = path.relative(API_ROOT, path.dirname(filePath));
    const segments = relativeDir
        .split(path.sep)
        .filter(Boolean)
        .map((segment) => {
            if (segment.startsWith("[") && segment.endsWith("]")) {
                return `{${segment.slice(1, -1)}}`;
            }

            return segment;
        });

    return `/${segments.join("/")}`;
}

function securityForPath(routePath: string) {
    if (routePath.startsWith("/admin")) {
        return [{ bearerAuth: [] }];
    }

    if (routePath.startsWith("/store")) {
        return [{ publishableApiKey: [] }, { bearerAuth: [] }];
    }

    return [];
}

function tagForPath(routePath: string) {
    return routePath.split("/").filter(Boolean)[0] || "docs";
}

function humanizeOperation(method: HttpMethod, routePath: string) {
    return `${method.toUpperCase()} ${routePath}`;
}

function operationId(method: HttpMethod, routePath: string) {
    const normalizedPath = routePath
        .replace(/[{}]/g, "")
        .split("/")
        .filter(Boolean)
        .map((part) => part.replace(/[^a-zA-Z0-9]/g, " "))
        .flatMap((part) => part.split(" "))
        .filter(Boolean)
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join("");

    return `${method}${normalizedPath || "Root"}`;
}
