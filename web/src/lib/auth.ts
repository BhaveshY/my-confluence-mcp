import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { userOps, sessionOps, settingsOps, type User, type UserSettings } from "./db";

// Secret key for JWT - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || "confluence-gpt-secret-key-change-in-production";
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
const COOKIE_NAME = "confluence-gpt-session";

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Generate session token
export function generateSessionToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

// Verify session token
export function verifySessionToken(token: string): { userId: number } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    return decoded;
  } catch {
    return null;
  }
}

// Register new user
export async function registerUser(
  email: string,
  password: string,
  name: string
): Promise<{ success: true; user: Omit<User, "password_hash"> } | { success: false; error: string }> {
  // Validate input
  if (!email || !password || !name) {
    return { success: false, error: "All fields are required" };
  }

  if (password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters" };
  }

  // Check if user exists
  const existingUser = userOps.findByEmail(email.toLowerCase());
  if (existingUser) {
    return { success: false, error: "Email already registered" };
  }

  // Hash password and create user
  const passwordHash = await hashPassword(password);
  const user = userOps.create(email.toLowerCase(), passwordHash, name);

  // Create initial empty settings for user
  settingsOps.upsert(user.id, {});

  const { password_hash: _, ...userWithoutPassword } = user;
  return { success: true, user: userWithoutPassword };
}

// Login user
export async function loginUser(
  email: string,
  password: string
): Promise<{ success: true; user: Omit<User, "password_hash">; token: string } | { success: false; error: string }> {
  // Validate input
  if (!email || !password) {
    return { success: false, error: "Email and password are required" };
  }

  // Find user
  const user = userOps.findByEmail(email.toLowerCase());
  if (!user) {
    return { success: false, error: "Invalid email or password" };
  }

  // Verify password
  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    return { success: false, error: "Invalid email or password" };
  }

  // Generate session token
  const token = generateSessionToken(user.id);
  const expiresAt = new Date(Date.now() + SESSION_DURATION);

  // Store session in database
  sessionOps.create(user.id, token, expiresAt);

  const { password_hash: _, ...userWithoutPassword } = user;
  return { success: true, user: userWithoutPassword, token };
}

// Logout user
export async function logoutUser(token: string): Promise<void> {
  sessionOps.deleteByToken(token);
}

// Get current user from session
export async function getCurrentUser(): Promise<{
  user: Omit<User, "password_hash">;
  settings: UserSettings | null;
} | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(COOKIE_NAME);

    if (!sessionCookie?.value) {
      return null;
    }

    // Verify JWT
    const decoded = verifySessionToken(sessionCookie.value);
    if (!decoded) {
      return null;
    }

    // Check session in database
    const session = sessionOps.findByToken(sessionCookie.value);
    if (!session) {
      return null;
    }

    // Get user settings
    const settings = settingsOps.findByUserId(session.user.id) || null;

    const { password_hash: _, ...userWithoutPassword } = session.user;
    return { user: userWithoutPassword, settings };
  } catch {
    return null;
  }
}

// Get user from token (for API routes)
export function getUserFromToken(token: string): {
  user: Omit<User, "password_hash">;
  settings: UserSettings | null;
} | null {
  // Verify JWT
  const decoded = verifySessionToken(token);
  if (!decoded) {
    return null;
  }

  // Check session in database
  const session = sessionOps.findByToken(token);
  if (!session) {
    return null;
  }

  // Get user settings
  const settings = settingsOps.findByUserId(session.user.id) || null;

  const { password_hash: _, ...userWithoutPassword } = session.user;
  return { user: userWithoutPassword, settings };
}

// Set session cookie
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION / 1000,
    path: "/",
  });
}

// Clear session cookie
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// Update user settings
export async function updateUserSettings(
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
): Promise<UserSettings> {
  return settingsOps.upsert(userId, settings);
}

