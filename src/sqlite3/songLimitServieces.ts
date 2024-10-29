import { db } from "./db.js";

export const insertDefaultLimit = async () => {
  const rowCount = await (
    db.prepare("SELECT COUNT(*) as count FROM songLimit").get() as {
      count: number;
    }
  ).count;

  if (rowCount === 0) {
    try {
      const insert = await db.prepare(
        "INSERT INTO songLimit (limit_value) VALUES (?)"
      );
      insert.run(10);
    } catch (error: any) {
      console.error("Error inserting limit value:", error.message);
    }
  }

  return;
};

export const getSongLimit = async (): Promise<number | null> => {
  await insertDefaultLimit();
  try {
    const limit = db
      .prepare(
        "\
                SELECT limit_value \
                FROM songLimit \
                WHERE id = 1 \
                "
      )
      .get() as { limit_value: number };

    if (!limit) {
      return null;
    }

    return limit.limit_value;
  } catch (error) {
    console.log("songLimitServieces, changeSongLimit", error);
    return null;
  }
};

export const changeSongLimit = async (
  newLimit: number
): Promise<null | { changes: number }> => {
  try {
    const info = db
      .prepare(
        "\
              UPDATE songLimit \
              SET limit_value = ? \
              WHERE id = 1 \
          "
      )
      .run(newLimit) as {
      changes: number;
    };

    if (!info) {
      return null;
    }

    return info;
  } catch (error) {
    console.log("songLimitServieces, changeSongLimit", error);
    return null;
  }
};
