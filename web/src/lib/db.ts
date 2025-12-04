import Database from "better-sqlite3";
import path from "path";

// Database file location - in the project root
const DB_PATH = path.join(process.cwd(), "confluence-gpt.db");

// Create database instance
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma("journal_mode = WAL");

// Initialize database schema
db.exec(`
  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- User settings table (stores Confluence and AI settings per user)
  CREATE TABLE IF NOT EXISTS user_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    confluence_domain TEXT,
    confluence_email TEXT,
    confluence_token TEXT,
    ai_api_key TEXT,
    ai_base_url TEXT DEFAULT 'https://api.deepseek.com',
    ai_model TEXT DEFAULT 'deepseek-chat',
    ai_enabled INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Sessions table for managing login sessions
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Conversations table for chat history
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Messages table for chat messages
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    attachment_filename TEXT,
    attachment_preview TEXT,
    action_type TEXT,
    action_status TEXT,
    action_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );

  -- Create indexes for performance
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
  CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
  CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
`);

// Type definitions
export interface User {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  id: number;
  user_id: number;
  confluence_domain: string | null;
  confluence_email: string | null;
  confluence_token: string | null;
  ai_api_key: string | null;
  ai_base_url: string;
  ai_model: string;
  ai_enabled: number;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: number;
  user_id: number;
  token: string;
  expires_at: string;
  created_at: string;
}

export interface Conversation {
  id: number;
  user_id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: "user" | "assistant";
  content: string;
  attachment_filename: string | null;
  attachment_preview: string | null;
  action_type: string | null;
  action_status: string | null;
  action_data: string | null;
  created_at: string;
}

// User operations
export const userOps = {
  findByEmail: (email: string): User | undefined => {
    return db.prepare("SELECT * FROM users WHERE email = ?").get(email) as User | undefined;
  },

  findById: (id: number): User | undefined => {
    return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User | undefined;
  },

  create: (email: string, passwordHash: string, name: string): User => {
    const stmt = db.prepare(
      "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)"
    );
    const result = stmt.run(email, passwordHash, name);
    return userOps.findById(result.lastInsertRowid as number)!;
  },

  updatePassword: (id: number, passwordHash: string): void => {
    db.prepare(
      "UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(passwordHash, id);
  },
};

// Settings operations
export const settingsOps = {
  findByUserId: (userId: number): UserSettings | undefined => {
    return db.prepare("SELECT * FROM user_settings WHERE user_id = ?").get(userId) as UserSettings | undefined;
  },

  upsert: (
    userId: number,
    settings: {
      confluence_domain?: string | null;
      confluence_email?: string | null;
      confluence_token?: string | null;
      ai_api_key?: string | null;
      ai_base_url?: string;
      ai_model?: string;
      ai_enabled?: boolean;
    }
  ): UserSettings => {
    const existing = settingsOps.findByUserId(userId);

    if (existing) {
      db.prepare(`
        UPDATE user_settings SET
          confluence_domain = COALESCE(?, confluence_domain),
          confluence_email = COALESCE(?, confluence_email),
          confluence_token = COALESCE(?, confluence_token),
          ai_api_key = COALESCE(?, ai_api_key),
          ai_base_url = COALESCE(?, ai_base_url),
          ai_model = COALESCE(?, ai_model),
          ai_enabled = COALESCE(?, ai_enabled),
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(
        settings.confluence_domain,
        settings.confluence_email,
        settings.confluence_token,
        settings.ai_api_key,
        settings.ai_base_url,
        settings.ai_model,
        settings.ai_enabled !== undefined ? (settings.ai_enabled ? 1 : 0) : undefined,
        userId
      );
    } else {
      db.prepare(`
        INSERT INTO user_settings (
          user_id, confluence_domain, confluence_email, confluence_token,
          ai_api_key, ai_base_url, ai_model, ai_enabled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        settings.confluence_domain || null,
        settings.confluence_email || null,
        settings.confluence_token || null,
        settings.ai_api_key || null,
        settings.ai_base_url || "https://api.deepseek.com",
        settings.ai_model || "deepseek-chat",
        settings.ai_enabled ? 1 : 0
      );
    }

    return settingsOps.findByUserId(userId)!;
  },
};

// Session operations
export const sessionOps = {
  findByToken: (token: string): (Session & { user: User }) | undefined => {
    const session = db.prepare(`
      SELECT s.*, u.id as user_id, u.email, u.name, u.created_at as user_created_at
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > datetime('now')
    `).get(token) as any;

    if (!session) return undefined;

    return {
      id: session.id,
      user_id: session.user_id,
      token: session.token,
      expires_at: session.expires_at,
      created_at: session.created_at,
      user: {
        id: session.user_id,
        email: session.email,
        name: session.name,
        password_hash: "",
        created_at: session.user_created_at,
        updated_at: session.user_created_at,
      },
    };
  },

  create: (userId: number, token: string, expiresAt: Date): Session => {
    const stmt = db.prepare(
      "INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)"
    );
    const result = stmt.run(userId, token, expiresAt.toISOString());
    return db.prepare("SELECT * FROM sessions WHERE id = ?").get(result.lastInsertRowid) as Session;
  },

  deleteByToken: (token: string): void => {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  },

  deleteByUserId: (userId: number): void => {
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  },

  deleteExpired: (): void => {
    db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
  },
};

// Clean up expired sessions periodically
sessionOps.deleteExpired();

// Conversation operations
export const conversationOps = {
  findById: (id: number): Conversation | undefined => {
    return db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as Conversation | undefined;
  },

  findByUserId: (userId: number, limit = 50): Conversation[] => {
    return db.prepare(`
      SELECT * FROM conversations 
      WHERE user_id = ? 
      ORDER BY updated_at DESC 
      LIMIT ?
    `).all(userId, limit) as Conversation[];
  },

  create: (userId: number, title: string): Conversation => {
    const stmt = db.prepare(
      "INSERT INTO conversations (user_id, title) VALUES (?, ?)"
    );
    const result = stmt.run(userId, title);
    return conversationOps.findById(result.lastInsertRowid as number)!;
  },

  updateTitle: (id: number, title: string): void => {
    db.prepare(
      "UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(title, id);
  },

  touch: (id: number): void => {
    db.prepare(
      "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(id);
  },

  delete: (id: number): void => {
    db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
  },

  deleteByUserId: (userId: number): void => {
    db.prepare("DELETE FROM conversations WHERE user_id = ?").run(userId);
  },
};

// Message operations
export const messageOps = {
  findByConversationId: (conversationId: number): Message[] => {
    return db.prepare(
      "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC"
    ).all(conversationId) as Message[];
  },

  create: (
    conversationId: number,
    message: {
      role: "user" | "assistant";
      content: string;
      attachment_filename?: string;
      attachment_preview?: string;
      action_type?: string;
      action_status?: string;
      action_data?: string;
    }
  ): Message => {
    const stmt = db.prepare(`
      INSERT INTO messages (
        conversation_id, role, content, 
        attachment_filename, attachment_preview,
        action_type, action_status, action_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      conversationId,
      message.role,
      message.content,
      message.attachment_filename || null,
      message.attachment_preview || null,
      message.action_type || null,
      message.action_status || null,
      message.action_data || null
    );
    
    // Update conversation timestamp
    conversationOps.touch(conversationId);
    
    return db.prepare("SELECT * FROM messages WHERE id = ?").get(result.lastInsertRowid) as Message;
  },

  updateAction: (id: number, status: string, data?: string): void => {
    db.prepare(
      "UPDATE messages SET action_status = ?, action_data = COALESCE(?, action_data) WHERE id = ?"
    ).run(status, data || null, id);
  },

  getLastMessage: (conversationId: number): Message | undefined => {
    return db.prepare(
      "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1"
    ).get(conversationId) as Message | undefined;
  },
};

export default db;

