/*
File: petition_routes.js
Purpose: Registers the petition API routes.
    This file centralizes auth checks, petition validation, and error formatting.
Date Created: 2026-02-23
Initial Author(s): David Haddad

System Context:
Acts as the backend petition API boundary for the group scheduling workflow.
Authenticates and validates petitions made by users on the frontend and sends responses.
*/

const crypto = require("crypto");

/**
 * Ensures a stable trace ID is attached to the current request/response lifecycle.
 * Reuses an existing trace ID when already present on `res.locals`.
 *
 * @param {Object} res - Express response object
 * @returns {string} Trace ID associated with the request
 */
function ensureTraceId(res) {
  // Reuse one trace id for the whole request so logs and responses line up.
  if (!res.locals.traceId) {
    res.locals.traceId = crypto.randomUUID();
    res.setHeader("X-Trace-Id", res.locals.traceId);
  }
  return res.locals.traceId;
}

/**
 * Middleware that attaches a trace ID to each incoming request before route handlers run.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next callback
 * @returns {void}
 */
function withTraceId(req, res, next) {
  ensureTraceId(res);
  next();
}

/**
 * Sends a standardized API error response payload including trace ID and optional metadata.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {number} status - HTTP status code
 * @param {string} message - Error message for API client
 * @param {Object} [extra={}] - Additional error payload fields
 * @returns {Object} Express JSON response
 */
function sendApiError(req, res, status, message, extra = {}) {
  // Attach the trace id to every error response the frontend sees.
  const traceId = ensureTraceId(res);
  return res.status(status).json({ error: message, traceId, ...extra });
}

/**
 * Writes a structured petition-route error log entry for diagnostics and tracing.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {string} stage - Logical stage name where the error occurred
 * @param {Error} error - Error object
 * @param {Object} [extra={}] - Extra log metadata
 * @returns {void}
 */
function logRouteError(req, res, stage, error, extra = {}) {
  // Keep the route logs structured so petition failures can be traced back quickly.
  const traceId = ensureTraceId(res);
  console.error("[PetitionRoutes]", {
    traceId,
    stage,
    method: req.method,
    path: req.originalUrl,
    userId: req.userId ?? null,
    groupId: req.groupId ?? null,
    petitionId: req.params?.petitionId ?? null,
    errorMessage: error?.message || String(error),
    ...extra
  });
}

/**
 * Middleware that enforces authenticated session access and stores normalized user ID on request.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next callback
 * @returns {Object|void} Early error response or next middleware invocation
 */
function requireAuth(req, res, next) {
  // Copy the session user id onto the request once auth passes.
  if (!req.session || !req.session.userId || !req.session.isAuthenticated) {
    return sendApiError(req, res, 401, "Unauthorized");
  }

  req.userId = Number(req.session.userId);
  return next();
}

/**
 * Factory for middleware that validates group existence and current-user group membership.
 *
 * @param {Object} db - Database interface with group lookup helpers
 * @returns {Function} Express middleware function
 */
function requireGroupMember(db) {
  /**
   * Middleware that validates groupId param, confirms group exists, and ensures current user is a member.
   *
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next callback
   * @returns {Promise<Object|void>} Early error response or next middleware invocation
   */
  return async function requireGroupMemberMiddleware(req, res, next) {
    // Validate the route parameter before hitting the database.
    const groupId = Number(req.params.groupId);
    if (!Number.isInteger(groupId) || groupId <= 0) {
      return sendApiError(req, res, 400, "Invalid groupId");
    }

    try {
      const group = await db.getGroupById(groupId);
      if (!group) {
        return sendApiError(req, res, 404, "Group not found");
      }

      const inGroup = await db.isUserInGroup(req.userId, groupId);
      if (!inGroup) {
        return sendApiError(req, res, 403, "Forbidden");
      }

      req.groupId = groupId;
      return next();
    } catch (error) {
      logRouteError(req, res, "requireGroupMember", error);
      return sendApiError(req, res, 500, "Internal Server Error");
    }
  };
}

/**
 * Parses timestamp input as epoch milliseconds from number, numeric string, or date string.
 *
 * @param {number|string|*} value - Timestamp candidate input
 * @returns {number} Parsed epoch milliseconds, or `NaN` for invalid input
 */
function parseEpochMs(value) {
  // Accept either epoch-like numbers or date strings from older callers.
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) return asNumber;
    const asDate = Date.parse(value);
    if (Number.isFinite(asDate)) return asDate;
  }
  return NaN;
}

/**
 * Normalizes petition blocking level values to supported uppercase tokens.
 *
 * @param {string|*} input - Blocking-level input value
 * @returns {"B1"|"B2"|"B3"|null} Normalized blocking level or null when invalid
 */
function normalizeBlockingLevel(input) {
  // Default to the middle blocking level when callers omit the field.
  const level = String(input || "B2").toUpperCase();
  if (level === "B1" || level === "B2" || level === "B3") return level;
  return null;
}

/**
 * Normalizes petition response payload values to canonical `ACCEPTED` / `DECLINED` values.
 *
 * @param {string|*} input - Response input value
 * @returns {"ACCEPTED"|"DECLINED"|null} Normalized response value or null when invalid
 */
function normalizeResponse(input) {
  const raw = String(input || "").toUpperCase();
  if (raw === "ACCEPT" || raw === "ACCEPTED") return "ACCEPTED";
  if (raw === "DECLINE" || raw === "DECLINED") return "DECLINED";
  return null;
}

/**
 * Creates a decorated Error object with attached HTTP status and optional metadata.
 *
 * @param {number} status - HTTP status code to attach
 * @param {string} message - Error message
 * @param {Object} [extra={}] - Additional error fields
 * @returns {Error} Decorated error instance
 */
function createHttpError(status, message, extra = {}) {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extra);
  return error;
}

/**
 * Validates and normalizes incoming petition-creation payload into internal route input shape.
 * Supports both legacy and current field naming.
 *
 * @param {Object} body - Petition creation request body
 * @returns {{startMs:number,endMs:number,title:string,blockingLevel:"B1"|"B2"|"B3"}} Normalized petition input
 * @throws {Error} HTTP-style validation error for missing/invalid fields
 */
function parseCreatePetitionInput(body) {
  // Normalize the legacy and modern petition payload shapes into one validated object.
  const startMs = parseEpochMs(body?.start);
  const endMs = parseEpochMs(body?.end);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const blockingLevel = normalizeBlockingLevel(body?.blocking_level ?? body?.blockingLevel ?? "B2");

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    throw createHttpError(400, "start and end are required");
  }
  if (endMs <= startMs) {
    throw createHttpError(400, "end must be greater than start");
  }
  if (!title) {
    throw createHttpError(400, "title is required");
  }
  if (!blockingLevel) {
    throw createHttpError(400, "blocking_level must be B1, B2, or B3");
  }

  return {
    startMs,
    endMs,
    title,
    blockingLevel
  };
}

/**
 * Detects whether an error indicates petition schema/tables are missing in persistence.
 *
 * @param {Error|Object|null|undefined} error - Error candidate
 * @returns {boolean} True when error maps to missing petition schema condition
 */
function isPetitionSchemaMissingError(error) {
  // Recognize both wrapped app errors and raw Postgres missing-table errors.
  if (!error) return false;
  if (error.appCode === "PETITION_SCHEMA_MISSING") return true;
  if (error.code !== "42P01") return false;
  const message = String(error.message || "").toLowerCase();
  return message.includes("petitions") || message.includes("petition_responses");
}

/**
 * Maps raw petition-route errors into API response status/message/extra payload fields.
 *
 * @param {Error|Object} error - Error object from route logic
 * @param {string} fallbackMessage - Default message when error has none
 * @returns {{status:number,message:string,extra:Object}} 
 */
function resolvePetitionApiError(error, fallbackMessage) {
  if (isPetitionSchemaMissingError(error)) {
    return {
      status: 503,
      message: "Petition schema is not initialized",
      extra: {
        code: "PETITION_SCHEMA_MISSING"
      }
    };
  }

  const status = Number.isInteger(error?.status) ? error.status : 500;
  const message = error?.message || fallbackMessage;
  const extra = {};

  if (typeof error?.appCode === "string" && error.appCode.trim()) {
    extra.code = error.appCode;
  }
  if (Array.isArray(error?.missingTables) && error.missingTables.length > 0) {
    extra.missingTables = error.missingTables;
  }

  return { status, message, extra };
}

/**
 * Sends a classified petition API error response using resolved status/message/metadata.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Error|Object} error
 * @param {string} fallbackMessage - Default message when error has none
 * @returns {Object} Express JSON response
 */
function sendClassifiedError(req, res, error, fallbackMessage) {
  const resolved = resolvePetitionApiError(error, fallbackMessage);
  return sendApiError(req, res, resolved.status, resolved.message, resolved.extra);
}

/**
 * Adds route-level convenience flags to petition payload for frontend display logic.
 *
 * @param {Object} petition - Petition object from persistence layer
 * @param {number|string} userId - Current authenticated user ID
 * @returns {Object} Petition object decorated with `is_creator` boolean
 */
function decoratePetitionForUser(petition, userId) {
  // Add the creator flag the frontend uses for button visibility.
  if (!petition || typeof petition !== "object") {
    return petition;
  }

  const creatorId = Number(
    petition.created_by_user_id ??
    petition.createdByUserId ??
    petition.created_by_person_id
  );

  return {
    ...petition,
    is_creator: Number.isFinite(creatorId) && Number(creatorId) === Number(userId)
  };
}

/**
 * Registers petition-related API routes and middleware on an Express application instance.
 *
 * @param {Object} app - Express app instance
 * @param {{db:Object}} deps 
 */
function registerPetitionRoutes(app, { db }) {
  // Verify that the petition tables exist before the frontend opens petition UI.
  app.get("/api/groups/:groupId/petitions/preflight", withTraceId, requireAuth, requireGroupMember(db), async (req, res) => {
    try {
      await db.assertPetitionSchemaReady();
      return res.status(200).json({
        ok: true,
        groupId: req.groupId,
        userId: req.userId
      });
    } catch (error) {
      logRouteError(req, res, "petitionPreflight", error);
      return sendClassifiedError(req, res, error, "Unable to verify petition access");
    }
  });

  // Create a petition for one group after auth and membership checks pass.
  app.post("/api/groups/:groupId/petitions", withTraceId, requireAuth, requireGroupMember(db), async (req, res) => {
    try {
      const parsed = parseCreatePetitionInput(req.body);

      const petition = await db.createPetition({
        groupId: req.groupId,
        creatorUserId: req.userId,
        title: parsed.title,
        startMs: parsed.startMs,
        endMs: parsed.endMs,
        blockingLevel: parsed.blockingLevel
      });

      return res.status(201).json(decoratePetitionForUser(petition, req.userId));
    } catch (error) {
      logRouteError(req, res, "createPetition", error);
      return sendClassifiedError(req, res, error, "Failed to create petition");
    }
  });

  // List the petitions for the currently selected group.
  app.get("/api/groups/:groupId/petitions", withTraceId, requireAuth, requireGroupMember(db), async (req, res) => {
    try {
      const petitions = await db.listGroupPetitions({
        groupId: req.groupId,
        userId: req.userId
      });
      return res.status(200).json(
        Array.isArray(petitions)
          ? petitions.map((petition) => decoratePetitionForUser(petition, req.userId))
          : []
      );
    } catch (error) {
      logRouteError(req, res, "listGroupPetitions", error);
      return sendClassifiedError(req, res, error, "Failed to list group petitions");
    }
  });

  // List every petition visible to the current user.
  app.get("/api/petitions", withTraceId, requireAuth, async (req, res) => {
    try {
      const petitions = await db.listUserPetitions({ userId: req.userId });
      return res.status(200).json(
        Array.isArray(petitions)
          ? petitions.map((petition) => decoratePetitionForUser(petition, req.userId))
          : []
      );
    } catch (error) {
      logRouteError(req, res, "listUserPetitions", error);
      return sendClassifiedError(req, res, error, "Failed to list user petitions");
    }
  });

  // Record one user's ACCEPT or DECLINE response.
  app.post("/api/petitions/:petitionId/respond", withTraceId, requireAuth, async (req, res) => {
    try {
      const petitionId = Number(req.params.petitionId);
      if (!Number.isInteger(petitionId) || petitionId <= 0) {
        return sendApiError(req, res, 400, "Invalid petitionId");
      }

      const response = normalizeResponse(req.body?.response);
      if (!response) {
        return sendApiError(req, res, 400, "response must be ACCEPT or DECLINE");
      }

      const petition = await db.respondToPetition({
        petitionId,
        userId: req.userId,
        response
      });

      return res.status(200).json(decoratePetitionForUser(petition, req.userId));
    } catch (error) {
      logRouteError(req, res, "respondToPetition", error);
      return sendClassifiedError(req, res, error, "Failed to respond to petition");
    }
  });

  // Let a creator delete their own petition.
  app.delete("/api/petitions/:petitionId", withTraceId, requireAuth, async (req, res) => {
    try {
      const petitionId = Number(req.params.petitionId);
      if (!Number.isInteger(petitionId) || petitionId <= 0) {
        return sendApiError(req, res, 400, "Invalid petitionId");
      }

      const result = await db.deletePetitionByCreator({
        petitionId,
        userId: req.userId
      });

      return res.status(200).json(result);
    } catch (error) {
      logRouteError(req, res, "deletePetition", error);
      return sendClassifiedError(req, res, error, "Failed to delete petition");
    }
  });
}

registerPetitionRoutes.parseCreatePetitionInput = parseCreatePetitionInput;
registerPetitionRoutes.resolvePetitionApiError = resolvePetitionApiError;
registerPetitionRoutes.decoratePetitionForUser = decoratePetitionForUser;
registerPetitionRoutes.ensureTraceId = ensureTraceId;
registerPetitionRoutes.sendApiError = sendApiError;

module.exports = registerPetitionRoutes;
