import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  getDocument,
} from '../controllers/documentController.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get single document
router.get('/:id', getDocument);

export default router;
