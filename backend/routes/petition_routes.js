function sendApiError(res, status, message, extra = {}) {
  return res.status(status).json({ error: message, ...extra });
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId || !req.session.isAuthenticated) {
    return sendApiError(res, 401, "Unauthorized");
  }

  req.userId = Number(req.session.userId);
  return next();
}

function requireGroupMember(db) {
  return async function requireGroupMemberMiddleware(req, res, next) {
    const groupId = Number(req.params.groupId);
    if (!Number.isInteger(groupId) || groupId <= 0) {
      return sendApiError(res, 400, "Invalid groupId");
    }

    try {
      const group = await db.getGroupById(groupId);
      if (!group) {
        return sendApiError(res, 404, "Group not found");
      }

      const inGroup = await db.isUserInGroup(req.userId, groupId);
      if (!inGroup) {
        return sendApiError(res, 403, "Forbidden");
      }

      req.groupId = groupId;
      return next();
    } catch (error) {
      console.error("requireGroupMember error:", error);
      return sendApiError(res, 500, "Internal Server Error");
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

module.exports = function registerPetitionRoutes(app, { db }) {
  app.post("/api/groups/:groupId/petitions", requireAuth, requireGroupMember(db), async (req, res) => {
    try {
      const startMs = parseEpochMs(req.body?.start);
      const endMs = parseEpochMs(req.body?.end);
      const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
      const blockingLevel = normalizeBlockingLevel(req.body?.blocking_level ?? req.body?.blockingLevel ?? "B2");

      if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
        return sendApiError(res, 400, "start and end are required");
      }
      if (endMs <= startMs) {
        return sendApiError(res, 400, "end must be greater than start");
      }
      if (!title) {
        return sendApiError(res, 400, "title is required");
      }
      if (!blockingLevel) {
        return sendApiError(res, 400, "blocking_level must be B1, B2, or B3");
      }

      const petition = await db.createPetition({
        groupId: req.groupId,
        creatorUserId: req.userId,
        title,
        startMs,
        endMs,
        blockingLevel
      });

      return res.status(201).json(decoratePetitionForUser(petition, req.userId));
    } catch (error) {
      console.error("create petition error:", error);
      return sendApiError(res, error.status || 500, error.message || "Failed to create petition");
    }
  });

  app.get("/api/groups/:groupId/petitions", requireAuth, requireGroupMember(db), async (req, res) => {
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
      console.error("list group petitions error:", error);
      return sendApiError(res, 500, "Failed to list group petitions");
    }
  });

  app.get("/api/petitions", requireAuth, async (req, res) => {
    try {
      const petitions = await db.listUserPetitions({ userId: req.userId });
      return res.status(200).json(
        Array.isArray(petitions)
          ? petitions.map((petition) => decoratePetitionForUser(petition, req.userId))
          : []
      );
    } catch (error) {
      console.error("list user petitions error:", error);
      return sendApiError(res, 500, "Failed to list user petitions");
    }
  });

  app.post("/api/petitions/:petitionId/respond", requireAuth, async (req, res) => {
    try {
      const petitionId = Number(req.params.petitionId);
      if (!Number.isInteger(petitionId) || petitionId <= 0) {
        return sendApiError(res, 400, "Invalid petitionId");
      }

      const response = normalizeResponse(req.body?.response);
      if (!response) {
        return sendApiError(res, 400, "response must be ACCEPT or DECLINE");
      }

      const petition = await db.respondToPetition({
        petitionId,
        userId: req.userId,
        response
      });

      return res.status(200).json(decoratePetitionForUser(petition, req.userId));
    } catch (error) {
      console.error("respond to petition error:", error);
      return sendApiError(res, error.status || 500, error.message || "Failed to respond to petition");
    }
  });

  app.delete("/api/petitions/:petitionId", requireAuth, async (req, res) => {
    try {
      const petitionId = Number(req.params.petitionId);
      if (!Number.isInteger(petitionId) || petitionId <= 0) {
        return sendApiError(res, 400, "Invalid petitionId");
      }

      const result = await db.deletePetitionByCreator({
        petitionId,
        userId: req.userId
      });

      return res.status(200).json(result);
    } catch (error) {
      console.error("delete petition error:", error);
      return sendApiError(res, error.status || 500, error.message || "Failed to delete petition");
    }
  });
};
