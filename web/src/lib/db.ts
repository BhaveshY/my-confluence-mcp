import { createClient, Client } from "@libsql/client";

// Database client - uses Turso in production, local file in development
let db: Client | null = null;

function getDb(): Client {
  if (!db) {
    // Check for Turso environment variables (production)
    if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
      db = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
      });
    } else {
      // Local development fallback - use in-memory or local file
      // Note: For local dev, you can set up a local Turso or use file:
      db = createClient({
        url: "file:confluence-gpt.db",
      });
    }
  }
  return db;
}

// Initialize database schema
export async function initializeDatabase(): Promise<void> {
  const client = getDb();
  
  await client.executeMultiple(`
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

  // Clean up expired sessions
  await client.execute("DELETE FROM sessions WHERE expires_at <= datetime('now')");
}

// Ensure database is initialized
let dbInitialized = false;
async function ensureDbInitialized(): Promise<Client> {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
  return getDb();
}

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
  findByEmail: async (email: string): Promise<User | undefined> => {
    const client = await ensureDbInitialized();
    const result = await client.execute({
      sql: "SELECT * FROM users WHERE email = ?",
      args: [email],
    });
    return result.rows[0] as unknown as User | undefined;
  },

  findById: async (id: number): Promise<User | undefined> => {
    const client = await ensureDbInitialized();
    const result = await client.execute({
      sql: "SELECT * FROM users WHERE id = ?",
      args: [id],
    });
    return result.rows[0] as unknown as User | undefined;
  },

  create: async (email: string, passwordHash: string, name: string): Promise<User> => {
    const client = await ensureDbInitialized();
    const result = await client.execute({
      sql: "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)",
      args: [email, passwordHash, name],
    });
    const user = await userOps.findById(Number(result.lastInsertRowid));
    return user!;
  },

  updatePassword: async (id: number, passwordHash: string): Promise<void> => {
    const client = await ensureDbInitialized();
    await client.execute({
      sql: "UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      args: [passwordHash, id],
    });
  },
};

// Settings operations
export const settingsOps = {
  findByUserId: async (userId: number): Promise<UserSettings | undefined> => {
    const client = await ensureDbInitialized();
    const result = await client.execute({
      sql: "SELECT * FROM user_settings WHERE user_id = ?",
      args: [userId],
    });
    return result.rows[0] as unknown as UserSettings | undefined;
  },

  upsert: async (
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
  ): Promise<UserSettings> => {
    const client = await ensureDbInitialized();
    const existing = await settingsOps.findByUserId(userId);

    if (existing) {
      await client.execute({
        sql: `
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
        `,
        args: [
          settings.confluence_domain ?? null,
          settings.confluence_email ?? null,
          settings.confluence_token ?? null,
          settings.ai_api_key ?? null,
          settings.ai_base_url ?? null,
          settings.ai_model ?? null,
          settings.ai_enabled !== undefined ? (settings.ai_enabled ? 1 : 0) : null,
          userId,
        ],
      });
    } else {
      await client.execute({
        sql: `
        INSERT INTO user_settings (
          user_id, confluence_domain, confluence_email, confluence_token,
          ai_api_key, ai_base_url, ai_model, ai_enabled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
        userId,
        settings.confluence_domain || null,
        settings.confluence_email || null,
        settings.confluence_token || null,
        settings.ai_api_key || null,
        settings.ai_base_url || "https://api.deepseek.com",
        settings.ai_model || "deepseek-chat",
          settings.ai_enabled ? 1 : 0,
        ],
      });
    }

    return (await settingsOps.findByUserId(userId))!;
  },
};

// Session operations
export const sessionOps = {
  findByToken: async (token: string): Promise<(Session & { user: User }) | undefined> => {
    const client = await ensureDbInitialized();
    const result = await client.execute({
      sql: `
      SELECT s.*, u.id as user_id, u.email, u.name, u.created_at as user_created_at
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > datetime('now')
      `,
      args: [token],
    });

    const session = result.rows[0] as any;
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

  create: async (userId: number, token: string, expiresAt: Date): Promise<Session> => {
    const client = await ensureDbInitialized();
    const result = await client.execute({
      sql: "INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)",
      args: [userId, token, expiresAt.toISOString()],
    });
    const sessionResult = await client.execute({
      sql: "SELECT * FROM sessions WHERE id = ?",
      args: [Number(result.lastInsertRowid)],
    });
    return sessionResult.rows[0] as unknown as Session;
  },

  deleteByToken: async (token: string): Promise<void> => {
    const client = await ensureDbInitialized();
    await client.execute({
      sql: "DELETE FROM sessions WHERE token = ?",
      args: [token],
    });
  },

  deleteByUserId: async (userId: number): Promise<void> => {
    const client = await ensureDbInitialized();
    await client.execute({
      sql: "DELETE FROM sessions WHERE user_id = ?",
      args: [userId],
    });
  },

  deleteExpired: async (): Promise<void> => {
    const client = await ensureDbInitialized();
    await client.execute("DELETE FROM sessions WHERE expires_at <= datetime('now')");
  },
};

// Conversation operations
export const conversationOps = {
  findById: async (id: number): Promise<Conversation | undefined> => {
    const client = await ensureDbInitialized();
    const result = await client.execute({
      sql: "SELECT * FROM conversations WHERE id = ?",
      args: [id],
    });
    return result.rows[0] as unknown as Conversation | undefined;
  },

  findByUserId: async (userId: number, limit = 50): Promise<Conversation[]> => {
    const client = await ensureDbInitialized();
    const result = await client.execute({
      sql: `
      SELECT * FROM conversations 
      WHERE user_id = ? 
      ORDER BY updated_at DESC 
      LIMIT ?
      `,
      args: [userId, limit],
    });
    return result.rows as unknown as Conversation[];
  },

  create: async (userId: number, title: string): Promise<Conversation> => {
    const client = await ensureDbInitialized();
    const result = await client.execute({
      sql: "INSERT INTO conversations (user_id, title) VALUES (?, ?)",
      args: [userId, title],
    });
    return (await conversationOps.findById(Number(result.lastInsertRowid)))!;
  },

  updateTitle: async (id: number, title: string): Promise<void> => {
    const client = await ensureDbInitialized();
    await client.execute({
      sql: "UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      args: [title, id],
    });
  },

  touch: async (id: number): Promise<void> => {
    const client = await ensureDbInitialized();
    await client.execute({
      sql: "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      args: [id],
    });
  },

  delete: async (id: number): Promise<void> => {
    const client = await ensureDbInitialized();
    await client.execute({
      sql: "DELETE FROM conversations WHERE id = ?",
      args: [id],
    });
  },

  deleteByUserId: async (userId: number): Promise<void> => {
    const client = await ensureDbInitialized();
    await client.execute({
      sql: "DELETE FROM conversations WHERE user_id = ?",
      args: [userId],
    });
  },
};

// Message operations
export const messageOps = {
  findByConversationId: async (conversationId: number): Promise<Message[]> => {
    const client = await ensureDbInitialized();
    const result = await client.execute({
      sql: "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
      args: [conversationId],
    });
    return result.rows as unknown as Message[];
  },

  create: async (
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
  ): Promise<Message> => {
    const client = await ensureDbInitialized();
    const result = await client.execute({
      sql: `
      INSERT INTO messages (
        conversation_id, role, content, 
        attachment_filename, attachment_preview,
        action_type, action_status, action_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
      conversationId,
      message.role,
      message.content,
      message.attachment_filename || null,
      message.attachment_preview || null,
      message.action_type || null,
      message.action_status || null,
        message.action_data || null,
      ],
    });
    
    // Update conversation timestamp
    await conversationOps.touch(conversationId);
    
    const msgResult = await client.execute({
      sql: "SELECT * FROM messages WHERE id = ?",
      args: [Number(result.lastInsertRowid)],
    });
    return msgResult.rows[0] as unknown as Message;
  },

  updateAction: async (id: number, status: string, data?: string): Promise<void> => {
    const client = await ensureDbInitialized();
    await client.execute({
      sql: "UPDATE messages SET action_status = ?, action_data = COALESCE(?, action_data) WHERE id = ?",
      args: [status, data || null, id],
    });
  },

  getLastMessage: async (conversationId: number): Promise<Message | undefined> => {
    const client = await ensureDbInitialized();
    const result = await client.execute({
      sql: "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1",
      args: [conversationId],
    });
    return result.rows[0] as unknown as Message | undefined;
  },
};

export default getDb;
