import { Router } from 'express';
import { createPersonHandler, listPeopleHandler } from '../controllers/people.controller.js';

const router = Router();

router.post('/', createPersonHandler);
router.get('/', listPeopleHandler);

export default router;
