import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { Prisma } from "@prisma/client";
import { audit } from "./audit/audit.js";
import { readHeaderValue } from "./auth/devAuth.js";
import { isHttpError } from "./core/errors.js";
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
import clientsRoute from "./modules/clients/routes.js";
import workspaceChecklistsRoute from "./modules/checklists/routes/workspace-checklists.route.js";
import workspaceChecklistInstancesRoute from "./modules/checklists/routes/workspace-checklist-instances.route.js";
import workspaceProjectsRoute from "./modules/projects/routes/workspace-projects.route.js";
import workspaceQuotesRoute from "./modules/quotes/routes/workspace-quotes.route.js";
import workspaceQuoteTemplatesRoute from "./modules/quotes/routes/workspace-quote-templates.route.js";
import workspaceCalendarRoute from "./modules/calendar/routes/workspace-calendar.route.js";
import workspaceMessagingRoute from "./modules/messaging/routes/workspace-messaging.route.js";
import workspaceWebAssetsRoute from "./routes/workspace-web-assets.route.js";

const DB_UNAVAILABLE_CODES = new Set(["P1001", "P1002", "P1017"]);
const DEV_DEFAULT_ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];
const DEV_EXPECTED_FRONTEND_ORIGIN = "http://localhost:5173";
const CORS_ALLOW_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
const CORS_ALLOW_HEADERS = "Content-Type, Authorization, X-Workspace-Id, X-Workspace-Slug, X-Google-Client-Id-Debug";

const sanitizeErrorMessage = (message: string) => message.replace(/\/\/([^:@/\s]+)(?::[^@/\s]*)?@/g, "//***:***@");

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
    const requestOriginRaw = typeof request.headers.origin === "string" ? request.headers.origin : null;
    const requestOrigin = requestOriginRaw ? normalizeOrigin(requestOriginRaw) : null;
    const isAllowedOrigin = requestOrigin ? corsAllowedOriginsSet.has(requestOrigin) : false;

    if (requestOrigin && isAllowedOrigin) {
      setCorsHeaders(reply, requestOrigin);
      if (request.url.startsWith("/auth/google")) {
        request.log.info(
          {
            reqId: request.id,
            requestOrigin,
            route: request.url,
          },
          "CORS allowed for Google auth request",
        );
      }
    }

    if (request.method !== "OPTIONS") {
      return;
    }

    if (requestOrigin && !isAllowedOrigin) {
      request.log.warn(
        {
          reqId: request.id,
          route: request.url,
          requestOrigin,
          corsAllowedOrigins,
        },
        "CORS origin blocked",
      );
      reply.code(403).send({
        error: "CORS origin not allowed",
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

  void app.register(authRoute);
  void app.register(workspaceBrandingRoute);
  void app.register(workspaceModulesRoute);
  void app.register(workspaceQuotesRoute);
  void app.register(workspaceQuoteTemplatesRoute);
  void app.register(workspaceCalendarRoute);
  void app.register(workspaceMessagingRoute);
  void app.register(workspaceWebAssetsRoute);
  void app.register(workspaceRolesRoute);
  void app.register(clientsRoute);
  void app.register(workspaceChecklistsRoute);
  void app.register(workspaceChecklistInstancesRoute);
  void app.register(workspaceProjectsRoute);

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
