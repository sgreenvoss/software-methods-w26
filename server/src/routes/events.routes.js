import { Router } from 'express';
import { refreshEvents, getEvents } from '../controllers/events.controller.js';

const router = Router();

router.post('/refresh', refreshEvents);
router.get('/refresh', refreshEvents);
router.get('/', getEvents);

export default router;
