import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  getDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
} from '../controllers/documentController.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get documents for a chat
router.get('/', getDocuments);

// Get single document
router.get('/:id', getDocument);

// Create document
router.post('/', createDocument);

// Update document
router.patch('/:id', updateDocument);

// Delete document
router.delete('/:id', deleteDocument);

export default router;
