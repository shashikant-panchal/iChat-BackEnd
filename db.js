const fs = require('fs');
const path = require('path');

// File paths
const DB_FILE = path.join(__dirname, 'chat.db');
const FALLBACK_FILE = path.join(__dirname, 'chat_fallback.json');

let db = null;
let useFallback = false;

// Fallback JSON-based Database implementation
const jsonDb = {
  messages: [],
  init() {
    if (fs.existsSync(FALLBACK_FILE)) {
      try {
        const data = fs.readFileSync(FALLBACK_FILE, 'utf8');
        this.messages = JSON.parse(data);
      } catch (err) {
        console.error('Error reading fallback JSON file, initializing empty history:', err);
        this.messages = [];
      }
    } else {
      this.save();
    }
  },
  save() {
    try {
      fs.writeFileSync(FALLBACK_FILE, JSON.stringify(this.messages, null, 2), 'utf8');
    } catch (err) {
      console.error('Error writing to fallback JSON file:', err);
    }
  },
  getMessages(limit = 100) {
    return this.messages.slice(-limit);
  },
  saveMessage(sender, text, timestamp) {
    const newMessage = {
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      sender,
      text,
      timestamp: timestamp || Date.now()
    };
    this.messages.push(newMessage);
    this.save();
    return newMessage;
  }
};

function initDb() {
  return new Promise((resolve) => {
    try {
      const sqlite3 = require('sqlite3').verbose();
      db = new sqlite3.Database(DB_FILE, (err) => {
        if (err) {
          console.warn('Could not open SQLite database, falling back to JSON file storage:', err.message);
          setupFallback(resolve);
        } else {
          db.run(
            `CREATE TABLE IF NOT EXISTS messages (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              sender TEXT NOT NULL,
              text TEXT NOT NULL,
              timestamp INTEGER NOT NULL
            )`,
            (createErr) => {
              if (createErr) {
                console.warn('Could not create messages table, falling back to JSON:', createErr.message);
                setupFallback(resolve);
              } else {
                console.log('SQLite database initialized successfully at', DB_FILE);
                resolve();
              }
            }
          );
        }
      });
    } catch (err) {
      console.warn('sqlite3 module not available or failed to load. Falling back to JSON file database.');
      setupFallback(resolve);
    }
  });
}

function setupFallback(resolve) {
  useFallback = true;
  jsonDb.init();
  console.log('Fallback JSON database initialized successfully at', FALLBACK_FILE);
  resolve();
}

function getMessages(limit = 100) {
  return new Promise((resolve, reject) => {
    if (useFallback) {
      return resolve(jsonDb.getMessages(limit));
    }

    db.all(
      `SELECT * FROM messages ORDER BY timestamp ASC LIMIT ?`,
      [limit],
      (err, rows) => {
        if (err) {
          console.error('Error retrieving messages from SQLite:', err);
          return reject(err);
        }
        resolve(rows);
      }
    );
  });
}

function saveMessage(sender, text) {
  const timestamp = Date.now();
  return new Promise((resolve, reject) => {
    if (useFallback) {
      return resolve(jsonDb.saveMessage(sender, text, timestamp));
    }

    db.run(
      `INSERT INTO messages (sender, text, timestamp) VALUES (?, ?, ?)`,
      [sender, text, timestamp],
      function (err) {
        if (err) {
          console.error('Error saving message to SQLite:', err);
          return reject(err);
        }
        resolve({
          id: this.lastID,
          sender,
          text,
          timestamp
        });
      }
    );
  });
}

module.exports = {
  initDb,
  getMessages,
  saveMessage
};
