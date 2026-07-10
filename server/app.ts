import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { Prisma } from "@prisma/client";
import { audit } from "./audit/audit.js";
import { readHeaderValue } from "./auth/devAuth.js";
import { isHttpError } from "./core/errors.js";
import { requestContext } from "./core/request-context.js";
import { fail, ok } from "./core/response.js";
import { requireAuth } from "./guards/requireAuth.js";
import { requireModuleEnabled } from "./guards/requireModule.js";
import { requirePermission } from "./guards/requirePermission.js";
import { requireWorkspace } from "./guards/requireWorkspace.js";
import { prisma } from "./prisma.js";
import authRoute from "./routes/auth.route.js";
import workspaceBrandingRoute from "./routes/workspace-branding.route.js";
import workspaceModulesRoute from "./routes/workspace-modules.route.js";
import workspaceRolesRoute from "./routes/workspace-roles.route.js";
import workspaceDepartmentsRoute from "./routes/workspace-departments.route.js";
import clientsRoute from "./modules/clients/routes.js";
import customFieldsRoute from "./modules/custom-fields/custom-fields.route.js";
import integrationsRoute from "./modules/integrations/integrations.route.js";
import sourcesRoute from "./modules/sources/sources.route.js";
import workspaceChecklistsRoute from "./modules/checklists/routes/workspace-checklists.route.js";
import workspaceChecklistInstancesRoute from "./modules/checklists/routes/workspace-checklist-instances.route.js";
import workspaceProjectsRoute from "./modules/projects/routes/workspace-projects.route.js";
import workspaceQuotesRoute from "./modules/quotes/routes/workspace-quotes.route.js";
import workspaceQuoteTemplatesRoute from "./modules/quotes/routes/workspace-quote-templates.route.js";
import workspaceCalendarRoute from "./modules/calendar/routes/workspace-calendar.route.js";
import workspaceMessagingRoute from "./modules/messaging/routes/workspace-messaging.route.js";
import workspaceDashboardRoute from "./modules/dashboard/routes/workspace-dashboard.route.js";
import workspaceAuditRoute from "./modules/audit/routes/workspace-audit.route.js";
import workspaceTeamRoute from "./modules/team/routes/workspace-team.route.js";
import workspaceVaultRoute from "./modules/vault/routes/workspace-vault.route.js";
import workspaceAgencyRoute from "./modules/agency-os/routes/workspace-agency.route.js";
import workspaceWebAssetsRoute from "./routes/workspace-web-assets.route.js";
import adminRoute from "./routes/admin.route.js";

const DB_UNAVAILABLE_CODES = new Set(["P1001", "P1002", "P1017"]);
const DEV_DEFAULT_ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];
const DEV_EXPECTED_FRONTEND_ORIGIN = "http://localhost:5173";
const DEV_ALLOWED_LOCALHOST_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);
const CORS_ALLOW_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
const CORS_ALLOW_HEADERS = "Content-Type, Authorization, X-Workspace-Id, X-Workspace-Slug, X-Google-Client-Id-Debug";

const sanitizeErrorMessage = (message: string) => message.replace(/\/\/([^:@/\s]+)(?::[^@/\s]*)?@/g, "//***:***@");

const isFastifyClientError = (error: unknown): error is { statusCode: number; code?: string; message?: string } => {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const maybeStatusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof maybeStatusCode === "number" && maybeStatusCode >= 400 && maybeStatusCode < 500;
};

const normalizeOrigin = (value: string): string | null => {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  try {
    return new URL(normalized).origin;
  } catch {
    return null;
  }
};

const parseAllowedOrigins = () => {
  const rawValue = process.env.ALLOWED_ORIGINS;
  const isProduction = process.env.NODE_ENV === "production";
  const candidates = rawValue
    ? rawValue.split(",")
    : isProduction
      ? []
      : DEV_DEFAULT_ALLOWED_ORIGINS;

  const normalizedOrigins = new Set<string>();
  for (const candidate of candidates) {
    const normalized = normalizeOrigin(candidate);
    if (normalized) {
      normalizedOrigins.add(normalized);
    }
  }

  return [...normalizedOrigins];
};

const setCorsHeaders = (reply: { header: (name: string, value: string) => void }, origin: string) => {
  reply.header("Access-Control-Allow-Origin", origin);
  reply.header("Access-Control-Allow-Credentials", "true");
  reply.header("Access-Control-Allow-Methods", CORS_ALLOW_METHODS);
  reply.header("Access-Control-Allow-Headers", CORS_ALLOW_HEADERS);
  reply.header("Vary", "Origin");
};

const isDevLoopbackOrigin = (origin: string) => {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  try {
    const parsedOrigin = new URL(origin);
    return parsedOrigin.protocol === "http:" && DEV_ALLOWED_LOCALHOST_HOSTNAMES.has(parsedOrigin.hostname);
  } catch {
    return false;
  }
};

const buildCorsDecision = (requestOriginRaw: string | null, corsAllowedOriginsSet: Set<string>) => {
  const requestOriginNormalized = requestOriginRaw ? normalizeOrigin(requestOriginRaw) : null;
  const allowedByList = requestOriginNormalized ? corsAllowedOriginsSet.has(requestOriginNormalized) : false;
  const allowedByDevLoopback = requestOriginNormalized ? isDevLoopbackOrigin(requestOriginNormalized) : false;
  const isAllowed = requestOriginNormalized ? (allowedByList || allowedByDevLoopback) : false;

  return {
    requestOriginRaw,
    requestOriginNormalized,
    allowedByList,
    allowedByDevLoopback,
    isAllowed,
  };
};

const isDatabaseUnavailableError = (error: unknown) => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("error validating datasource `db`") ||
      message.includes("the url must start with the protocol `prisma://`") ||
      message.includes("prisma+postgres://") ||
      message.includes("can't reach database server") ||
      message.includes("connection refused")
    ) {
      return true;
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError && error.message.includes("Error validating datasource `db`")) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && DB_UNAVAILABLE_CODES.has(error.code)) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    const message = error.message.toLowerCase();
    return message.includes("can't reach database server") || message.includes("connection refused");
  }

  return false;
};

const getDatabaseUnavailableDetails = (error: unknown) => {
  const details: Record<string, unknown> = {};

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    details.prismaCode = error.code;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    details.reason = sanitizeErrorMessage(error.message);
  }

  return details;
};

export const createApp = (options: FastifyServerOptions = {}): FastifyInstance => {
  const app = Fastify({
    logger: true,
    ...options,
  });
  const corsAllowedOrigins = parseAllowedOrigins();
  const corsAllowedOriginsSet = new Set(corsAllowedOrigins);

  app.log.info(
    {
      corsAllowedOrigins,
    },
    "CORS origins configured",
  );

  if (process.env.NODE_ENV !== "production" && !corsAllowedOriginsSet.has(DEV_EXPECTED_FRONTEND_ORIGIN)) {
    app.log.warn(
      {
        expectedOrigin: DEV_EXPECTED_FRONTEND_ORIGIN,
        configuredOrigins: corsAllowedOrigins,
      },
      "CORS dev origin missing. Requests from local frontend may fail.",
    );
  }

  app.addHook("onRequest", async (request, reply) => {
    // Apre lo store di contesto per questa richiesta: l'autenticazione vi scriverà
    // lo userId, che i livelli profondi (es. log costi AI) potranno leggere.
    requestContext.start();

    const requestOriginRaw = typeof request.headers.origin === "string" ? request.headers.origin : null;
    const corsDecision = buildCorsDecision(requestOriginRaw, corsAllowedOriginsSet);
    const isGoogleAuthRoute = request.url.startsWith("/auth/google");
    const isPreflight = request.method === "OPTIONS";
    const accessControlRequestMethodHeader =
      typeof request.headers["access-control-request-method"] === "string"
        ? request.headers["access-control-request-method"]
        : null;
    const accessControlRequestHeadersHeader =
      typeof request.headers["access-control-request-headers"] === "string"
        ? request.headers["access-control-request-headers"]
        : null;

    if (corsDecision.requestOriginNormalized && corsDecision.isAllowed) {
      setCorsHeaders(reply, corsDecision.requestOriginNormalized);
    }

    if (isGoogleAuthRoute && isPreflight) {
      request.log.info(
        {
          reqId: request.id,
          route: request.url,
          method: request.method,
          nodeEnv: process.env.NODE_ENV ?? "(unset)",
          accessControlRequestMethod: accessControlRequestMethodHeader,
          accessControlRequestHeaders: accessControlRequestHeadersHeader,
          corsDecision,
          corsAllowedOrigins,
        },
        "CORS debug: Google auth preflight evaluated",
      );
    }

    if (!isPreflight) {
      return;
    }

    if (corsDecision.requestOriginNormalized && !corsDecision.isAllowed) {
      request.log.warn(
        {
          reqId: request.id,
          route: request.url,
          requestOrigin: corsDecision.requestOriginNormalized,
          requestOriginRaw: corsDecision.requestOriginRaw,
          allowedByList: corsDecision.allowedByList,
          allowedByDevLoopback: corsDecision.allowedByDevLoopback,
          nodeEnv: process.env.NODE_ENV ?? "(unset)",
          accessControlRequestMethod: accessControlRequestMethodHeader,
          accessControlRequestHeaders: accessControlRequestHeadersHeader,
          corsAllowedOrigins,
        },
        "CORS origin blocked",
      );
      reply.header("x-cors-debug-id", request.id);
      reply.code(403).send({
        error: "CORS origin not allowed",
        reqId: request.id,
      });
      return;
    }

    reply.code(204).send();
  });

  app.setErrorHandler((error, request, reply) => {
    const isDev = process.env.NODE_ENV !== "production";

    if (isHttpError(error)) {
      return fail(reply, error.statusCode, error.code, error.message, error.details);
    }

    if (isFastifyClientError(error)) {
      const errorCode = typeof error.code === "string" && error.code.length > 0 ? error.code : "BAD_REQUEST";
      const errorMessage = typeof error.message === "string" && error.message.length > 0 ? error.message : "Bad request";
      return fail(reply, error.statusCode, errorCode, errorMessage);
    }

    if (isDatabaseUnavailableError(error)) {
      const details = getDatabaseUnavailableDetails(error);

      request.log.error(
        {
          reqId: request.id,
          err: error,
          ...details,
        },
        "Database unavailable while handling request",
      );

      return fail(reply, 503, "DATABASE_UNAVAILABLE", "Database is unavailable. Verify DATABASE_URL and database connectivity.", isDev ? details : undefined);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") {
      const meta = (error.meta ?? {}) as Record<string, unknown>;
      const column = typeof meta.column === "string" ? meta.column : null;
      const model = typeof meta.modelName === "string" ? meta.modelName : null;

      request.log.error(
        {
          reqId: request.id,
          err: error,
          prismaCode: error.code,
          column,
          model,
        },
        "Prisma schema mismatch / invalid field",
      );

      return fail(
        reply,
        400,
        "BAD_REQUEST",
        "Invalid field in database schema",
        isDev
          ? {
              prismaCode: "P2022",
              column,
              model,
            }
          : undefined,
      );
    }

    request.log.error(error, "Unhandled server error");
    return fail(reply, 500, "INTERNAL_SERVER_ERROR", "Internal server error");
  });

  app.setNotFoundHandler((_request, reply) => fail(reply, 404, "NOT_FOUND", "Resource not found"));
  void app.register(rateLimit, {
    global: false,
    max: 200,
    timeWindow: "1 minute",
  });
  void app.register(multipart, {
    limits: {
      files: 1,
      fileSize: 20 * 1024 * 1024,
    },
  });

  void app.register(authRoute);
  void app.register(workspaceBrandingRoute);
  void app.register(workspaceModulesRoute);
  void app.register(workspaceQuotesRoute);
  void app.register(workspaceQuoteTemplatesRoute);
  void app.register(workspaceCalendarRoute);
  void app.register(workspaceMessagingRoute);
  void app.register(workspaceDashboardRoute);
  void app.register(workspaceAuditRoute);
  void app.register(workspaceTeamRoute);
  void app.register(workspaceVaultRoute);
  void app.register(workspaceAgencyRoute);
  void app.register(workspaceWebAssetsRoute);
  void app.register(workspaceRolesRoute);
  void app.register(workspaceDepartmentsRoute);
  void app.register(clientsRoute);
  void app.register(customFieldsRoute);
  void app.register(integrationsRoute);
  void app.register(sourcesRoute);
  void app.register(workspaceChecklistsRoute);
  void app.register(workspaceChecklistInstancesRoute);
  void app.register(workspaceProjectsRoute);
  void app.register(adminRoute);

  app.get("/health", async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;

      return {
        status: "ok",
        db: "up",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      app.log.error(error, "Healthcheck failed");
      reply.code(503);

      return {
        status: "degraded",
        db: "down",
        timestamp: new Date().toISOString(),
      };
    }
  });

  app.get("/debug/cors", async (request, reply) => {
    const queryOrigin = typeof (request.query as { origin?: unknown } | undefined)?.origin === "string"
      ? ((request.query as { origin: string }).origin)
      : null;

    const corsDecision = buildCorsDecision(queryOrigin, corsAllowedOriginsSet);

    return ok(reply, {
      nodeEnv: process.env.NODE_ENV ?? "(unset)",
      corsAllowedOrigins,
      corsDecision,
      hint: "Pass ?origin=http://localhost:5174 to evaluate an origin.",
    });
  });

  app.get("/whoami", async (request, reply) => {
    const user = await requireAuth(request);
    const workspace = await requireWorkspace(request, user.id);

    const requiredModule = readHeaderValue(request, "x-required-module") ?? "modules";
    const requiredPermission = readHeaderValue(request, "x-required-permission") ?? "modules.manage";

    await requireModuleEnabled(workspace.id, requiredModule);
    await requirePermission(user.id, workspace.id, requiredPermission);

    await audit.log({
      event: "debug.whoami",
      actorUserId: user.id,
      workspaceId: workspace.id,
      metadata: {
        requiredModule,
        requiredPermission,
      },
      request,
    });

    return ok(reply, {
      user,
      workspace,
      authorization: {
        module: requiredModule,
        permission: requiredPermission,
      },
    });
  });

  return app;
};
