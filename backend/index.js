import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { connectDatabase } from './config/database.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import documentRoutes from './routes/documentRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/document', documentRoutes);

app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Route not found' 
  });
});

app.use(errorHandler);

async function startServer() {
  try {
    await connectDatabase();
    
    app.listen(PORT, () => {
      console.log(`Backend server running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`\n🔐 JWT Configuration:`);
      console.log(`   Secret: ${process.env.JWT_SECRET ? '✓ Set' : '✗ Not set (using fallback)'}`);
      console.log(`   Expires: ${process.env.JWT_EXPIRES_IN || '15d'}`);
      console.log(`\n📝 API Endpoints:`);
      console.log(`   POST /api/auth/register - Register new user`);
      console.log(`   POST /api/auth/login - Login user`);
      console.log(`   GET  /api/auth/me - Get current user`);
      console.log(`   GET  /api/chat - Get all chats`);
      console.log(`   POST /api/chat - Create new chat`);
      console.log(`   POST /api/chat/:id/stream - Send message (streaming)`);
      console.log(`\n If you get "invalid signature" errors:`);
      console.log(`   Clear browser localStorage and re-login\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
