import { DatabaseUser } from "../types/index.js";
import { db } from "./db.js";

export const getUserFromSession = async (sessionId: string) => {
  const userData = db
    .prepare(
      "\
        SELECT  user.id, user.discord_id, user.username, user.avatar, user.accent_color, \
                user.global_name, user.banner_color, user.email, user.role\
        FROM user \
        JOIN session ON user.id = session.user_id \
        WHERE session.id = ? \
    "
    )
    .get(sessionId);

  if (userData) {
    return userData as DatabaseUser;
  }

  return null;
};

export const getAllUsers = async () => {
  const allUsers = db
    .prepare("SELECT username, global_name, role, avatar, discord_id FROM user")
    .all();

  if (!allUsers) return undefined;

  return allUsers;
};

