require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { initDb, getMessages, saveMessage } = require('../db');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for API requests
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Basic health check endpoint
app.get('/', (req, res) => {
  res.send({ status: 'ok', message: 'Chat App Backend is running' });
});

// REST APIs
// 1. Fetch chat history
app.get('/api/messages', async (req, res) => {
  try {
    const messages = await getMessages(100);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch message history: ' + err.message });
  }
});

// 2. Send message (REST alternative to Socket)
app.post('/api/messages', async (req, res) => {
  const { sender, text } = req.body;
  if (!sender || !text) {
    return res.status(400).json({ error: 'Sender and text are required fields' });
  }
  try {
    const saved = await saveMessage(sender, text);
    // Broadcast the message via socket if socket server is initialized
    if (io) {
      io.emit('message', saved);
    }
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save message: ' + err.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'An unexpected error occurred on the server' });
});

// Create HTTP Server
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  // Ensure reliable polling fallback for environments like Vercel
  transports: ['websocket', 'polling']
});

// Connected Users tracking: maps socket.id to username
const activeUsers = new Map();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // 1. User joins the chat
  socket.on('join', (username) => {
    if (!username) return;
    
    // Register the user
    activeUsers.set(socket.id, username);
    console.log(`${username} joined the chat`);

    // Broadcast the list of active users to all clients
    io.emit('usersList', Array.from(activeUsers.values()));

    // Broadcast system message that user joined
    const systemMsg = {
      id: `sys-${Date.now()}`,
      sender: 'System',
      text: `${username} joined the chat`,
      timestamp: Date.now(),
      isSystem: true
    };
    socket.broadcast.emit('message', systemMsg);
  });

  // 2. User sends a message via Socket.io
  socket.on('message', async (data) => {
    const { sender, text } = data;
    if (!sender || !text) return;

    try {
      // Save message to database
      const savedMsg = await saveMessage(sender, text);
      
      // Broadcast message to all connected clients
      io.emit('message', savedMsg);
    } catch (err) {
      console.error('Error handling socket message:', err);
      socket.emit('error', { message: 'Failed to deliver message' });
    }
  });

  // 3. User is typing indicator
  socket.on('typing', (data) => {
    const { username, isTyping } = data;
    socket.broadcast.emit('typing', { username, isTyping });
  });

  // 4. User disconnects
  socket.on('disconnect', () => {
    const username = activeUsers.get(socket.id);
    if (username) {
      activeUsers.delete(socket.id);
      console.log(`${username} disconnected`);

      // Broadcast the updated users list
      io.emit('usersList', Array.from(activeUsers.values()));

      // Broadcast system message that user left
      const systemMsg = {
        id: `sys-${Date.now()}`,
        sender: 'System',
        text: `${username} left the chat`,
        timestamp: Date.now(),
        isSystem: true
      };
      io.emit('message', systemMsg);
    }
  });
});

// Initialize database, then listen
initDb().then(() => {
  // Only start the server listening if not imported in a serverless env like Vercel
  // or if explicitly run directly.
  if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on port ${PORT}`);
    });
  }
}).catch(err => {
  console.error('Failed to initialize database:', err);
});

// Export the server for deployment testing, and app for Vercel functions
module.exports = app;
