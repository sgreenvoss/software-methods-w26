import { Router } from 'express';
import { startOAuth, handleOAuthCallback } from '../controllers/auth.controller.js';

const router = Router();

router.get('/start', startOAuth);
router.get('/callback', handleOAuthCallback);

export default router;
