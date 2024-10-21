import { AuthRole, DatabaseUser } from "../types/index.js";
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

export const getUser = async ({
  username,
  discordId,
}: {
  username?: string;
  discordId?: string;
}) => {
  if (!username && !discordId)
    throw new Error("Username or discordId must be provided.");

  let query = "SELECT * FROM user WHERE ";
  let params: string[] = [];
  if (username) {
    query += "username = ? ";
    params.push(username);
  }
  if (discordId) {
    query += "discord_id = ? ";
    params.push(discordId);
  }
  query += ";";

  const user = db.prepare(query).get(...params);

  return user as DatabaseUser;
};

export const updateUserRole = async (username: string, role: AuthRole) => {
  const user = await getUser({ username });

  if (!user) {
    console.log("No user found", username);
    return;
  }

  const result = db
    .prepare("UPDATE user SET role = ? WHERE username = ?")
    .run(role, username);

  return result;
};
