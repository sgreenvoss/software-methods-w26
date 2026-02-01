import { Router } from 'express';
import {
  createGroupHandler,
  addMemberHandler,
  listMembersHandler,
  groupAvailabilityHandler,
  getGroupHandler,
} from '../controllers/groups.controller.js';

const router = Router();

router.post('/', createGroupHandler);
router.get('/:groupId', getGroupHandler);
router.get('/:groupId/members', listMembersHandler);
router.post('/:groupId/members', addMemberHandler);
router.get('/:groupId/availability', groupAvailabilityHandler);

export default router;
