import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  getUserChats,
  getChatById,
  createChat,
  sendMessage,
  streamMessage,
  deleteChat,
} from '../controllers/chatController.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get all chats for user
router.get('/', getUserChats);

// Get specific chat
router.get('/:id', getChatById);

// Create new chat
router.post('/', createChat);

// Send message and get response
router.post('/:id/message', sendMessage);

// Stream message (SSE)
router.post('/:id/stream', streamMessage);

// Delete chat
router.delete('/:id', deleteChat);

export default router;
