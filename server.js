import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import chatRouter from './src/api/routes/chat.js';
import ragRouter from './src/api/routes/rag.js';
import geeRouter from './src/api/routes/gee.js';
import firmsRouter from './src/api/routes/firms.js';
import fogosRouter from './src/api/routes/fogos.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes
app.use('/api/chat', chatRouter);
app.use('/api/rag', ragRouter);
app.use('/api/gee', geeRouter);
app.use('/api/firms', firmsRouter);
app.use('/api/fogos', fogosRouter);

// Serve React static files
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback - serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(port, () => {
  console.log(`🚀 FireAnalyst server running on port ${port}`);
  console.log(`   Frontend: http://localhost:${port}`);
  console.log(`   API: http://localhost:${port}/api`);
});
