# iChat — Backend Server

This is the Node.js + Express + Socket.io backend server for the iChat real-time chat application. It handles REST message operations and hosts the Socket.io WebSocket connections.

---

## Technical Stack & Features
- **Express APIs**: Fetch message history and post new messages.
- **Socket.io**: Real-time message broadcasting, typing states, and online/offline user lists.
- **Resilient Database Layer**: Configured to use a local SQLite database (`chat.db`) but automatically degrades to writing to a local JSON file (`chat_fallback.json`) if binary module installations fail.
- **Vercel Deployable**: Configured with `vercel.json` for serverless function execution.

---

## Project Structure
```text
backend/
├── api/
│   └── index.js      # Express Server & Socket.io Controller (Main Entry)
├── db.js             # Database Manager (SQLite / JSON Fallback)
├── package.json      # Dependencies and execution scripts
├── vercel.json       # Vercel Serverless routing configuration
└── .gitignore
```

---

## Getting Started

### 1. Installation
Navigate to the `backend` folder and install dependencies:
```bash
npm install
```

### 2. Environment Variables
Create a `.env` file in the `backend` directory (optional, default values are fallbacks in the source code):
```bash
# Server Port
PORT=3000
# Node Environment
NODE_ENV=development
```

### 3. Run Locally
- **Development Mode** (with automatic hot-reloads via nodemon):
  ```bash
  npm run dev
  ```
- **Production Mode**:
  ```bash
  npm start
  ```

*The server will start listening on `http://localhost:3000`. On boot, the terminal will indicate whether the SQLite database initialized successfully or fell back to the JSON file database.*

---

## API Endpoints

### 1. Fetch History
- **URL**: `/api/messages`
- **Method**: `GET`
- **Response**: List of message objects.
  ```json
  [
    {
      "id": 1,
      "sender": "Alice",
      "text": "Hello world!",
      "timestamp": 1783962546000
    }
  ]
  ```

### 2. Send Message (REST API Fallback)
- **URL**: `/api/messages`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "sender": "Alice",
    "text": "Hello world!"
  }
  ```
- **Response**: Saved message object with timestamp and unique ID.

---

## Real-Time Socket Events (Socket.io)

Clients connect and trigger/receive the following WebSocket packets:
- **`join` (Emit)**: Send the username to register as active.
- **`usersList` (Broadcast)**: Receives the updated list of all online usernames.
- **`message` (Emit/Broadcast)**: Sends/receives messages instantly.
- **`typing` (Emit/Broadcast)**: Sends/receives typing indicator flags (`{ username, isTyping: true/false }`).
- **`disconnect` (Event)**: Automatically handled when a user closes the socket; updates the active users lists.

---

## Hosting on Vercel
Vercel Serverless Functions have execution limits and do not support persistent TCP connections required for stateful WebSockets. 

While the REST APIs will work perfectly, Socket.io connections will fall back to HTTP long-polling. For a full WebSocket experience, we recommend hosting this server on persistent cloud providers like **Render** or **Railway**.
