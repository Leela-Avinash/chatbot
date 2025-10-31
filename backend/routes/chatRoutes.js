import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  getUserChats,
  getChatById,
  createChat,
  // sendMessage,
  streamMessage,
  deleteChat,
} from '../controllers/chatController.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getUserChats);
router.get('/:id', getChatById);
router.post('/', createChat);
router.post('/:id/stream', streamMessage);
router.delete('/:id', deleteChat);

export default router;
