import { NewVideo } from "../types/index.js";
import { db } from "./db.js";
import { generateId } from "lucia";

export const getAllUserFavs = async (
  userId: string
): Promise<NewVideo[] | null | undefined> => {
  try {
    const select = (await db
      .prepare(
        "\
        SELECT video_id, title, thumbnail_url \
        FROM favourite \
        WHERE user_id = ? \
      "
      )
      .all(userId)) as NewVideo[];

    if (!select) return null;

    return select;
  } catch (error) {
    console.log(`ERROR getAllUserFavs: ${error}`);
  }
};

export const addNewFavourite = async (
  videoId: string,
  title: string,
  thumbnailUrl: string,
  userId: string
) => {
  try {
    const randomId = generateId(24);

    const insert = await db
      .prepare(
        "\
        INSERT INTO favourite \
            (id, video_id, title, thumbnail_url, user_id) \
        VALUES (?,?,?,?,?) \
        "
      )
      .run(randomId, videoId, title, thumbnailUrl, userId);

    if (insert) {
      return insert;
    }

    return null;
  } catch (error: any) {
    console.log(`ERROR addNewFavourite: ${error}`);
  }
};

export const isAlreadyFavourite = async (
  videoId: string,
  userId: string
): Promise<boolean | undefined> => {
  try {
    const select = (await db
      .prepare(
        "\
        SELECT * FROM favourite \
        WHERE user_id = ? AND video_id = ? \
        "
      )
      .get(userId, videoId)) as Promise<NewVideo> | null;

    if (select) {
      return true;
    }

    return false;
  } catch (error: any) {
    console.log(`ERROR isAlreadyFavourite: ${error}`);
  }
};

export const removeFromFavourites = async (videoId: string, userId: string) => {
  try {
    const result = await db
      .prepare(
        "\
      DELETE FROM favourite \
      WHERE user_id = ? AND video_id = ? \
      "
      )
      .run(userId, videoId);

    if (!result) return null;

    return result;
  } catch (error) {
    console.log(`ERROR removeFromFavourites: ${error}`);
  }
};
