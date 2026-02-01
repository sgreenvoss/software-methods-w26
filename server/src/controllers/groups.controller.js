import { createGroup, getGroupById } from '../models/group.model.js';
import { addMemberToGroup, listGroupMembers } from '../models/group_match.model.js';
import { buildGroupAvailability } from '../services/groupAvailability.service.js';

export async function createGroupHandler(req, res, next) {
  try {
    const { groupName } = req.body;
    if (!groupName) {
      return res.status(400).json({ error: 'groupName is required' });
    }
    const group = await createGroup(groupName);
    res.json(group);
  } catch (err) {
    next(err);
  }
}

export async function addMemberHandler(req, res, next) {
  try {
    const groupId = Number(req.params.groupId);
    const { userId } = req.body;
    if (!Number.isFinite(groupId) || !Number.isFinite(Number(userId))) {
      return res.status(400).json({ error: 'groupId and userId are required numbers' });
    }
    await addMemberToGroup(groupId, Number(userId));
    const members = await listGroupMembers(groupId);
    res.json({ groupId, members });
  } catch (err) {
    next(err);
  }
}

export async function listMembersHandler(req, res, next) {
  try {
    const groupId = Number(req.params.groupId);
    const members = await listGroupMembers(groupId);
    res.json({ groupId, members });
  } catch (err) {
    next(err);
  }
}

export async function groupAvailabilityHandler(req, res, next) {
  try {
    const groupId = Number(req.params.groupId);
    const { windowStartMs, windowEndMs, granularityMinutes } = req.query;
    const data = await buildGroupAvailability({
      groupId,
      windowStartMs,
      windowEndMs,
      granularityMinutes: granularityMinutes ? Number(granularityMinutes) : undefined,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getGroupHandler(req, res, next) {
  try {
    const groupId = Number(req.params.groupId);
    const group = await getGroupById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    res.json(group);
  } catch (err) {
    next(err);
  }
}
