const crypto = require("crypto");

function ensureTraceId(res) {
  if (!res.locals.traceId) {
    res.locals.traceId = crypto.randomUUID();
    res.setHeader("X-Trace-Id", res.locals.traceId);
  }
  return res.locals.traceId;
}

function withTraceId(req, res, next) {
  ensureTraceId(res);
  next();
}

function sendApiError(req, res, status, message, extra = {}) {
  const traceId = ensureTraceId(res);
  return res.status(status).json({ error: message, traceId, ...extra });
}

function logRouteError(req, res, stage, error, extra = {}) {
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

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId || !req.session.isAuthenticated) {
    return sendApiError(req, res, 401, "Unauthorized");
  }

  req.userId = Number(req.session.userId);
  return next();
}

function requireGroupMember(db) {
  return async function requireGroupMemberMiddleware(req, res, next) {
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

function parseEpochMs(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) return asNumber;
    const asDate = Date.parse(value);
    if (Number.isFinite(asDate)) return asDate;
  }
  return NaN;
}

function normalizeBlockingLevel(input) {
  const level = String(input || "B2").toUpperCase();
  if (level === "B1" || level === "B2" || level === "B3") return level;
  return null;
}

function normalizeResponse(input) {
  const raw = String(input || "").toUpperCase();
  if (raw === "ACCEPT" || raw === "ACCEPTED") return "ACCEPTED";
  if (raw === "DECLINE" || raw === "DECLINED") return "DECLINED";
  return null;
}

function createHttpError(status, message, extra = {}) {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extra);
  return error;
}

function parseCreatePetitionInput(body) {
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

function isPetitionSchemaMissingError(error) {
  if (!error) return false;
  if (error.appCode === "PETITION_SCHEMA_MISSING") return true;
  if (error.code !== "42P01") return false;
  const message = String(error.message || "").toLowerCase();
  return message.includes("petitions") || message.includes("petition_responses");
}

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

function sendClassifiedError(req, res, error, fallbackMessage) {
  const resolved = resolvePetitionApiError(error, fallbackMessage);
  return sendApiError(req, res, resolved.status, resolved.message, resolved.extra);
}

function decoratePetitionForUser(petition, userId) {
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

function registerPetitionRoutes(app, { db }) {
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
