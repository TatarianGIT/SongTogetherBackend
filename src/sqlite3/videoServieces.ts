import { generateId } from "lucia";
import type {
  CurrentSong,
  NewVideo,
  SongQueue,
  VideoDetails,
} from "../types/index.js";
import { db } from "./db.js";

export const getVideoDetails = async (
  videoId: string
): Promise<VideoDetails | null> => {
  try {
    const video = db
      .prepare(
        "\
            SELECT \
              v.video_url as videoUrl, \
              v.video_id as videoId, \
              v.title, \
              v.length_seconds as lengthSeconds, \
              v.thumbnail_url as thumbnailUrl, \
              v.created_at as createdAt, \
              u.discord_id, \
              u.avatar, \
              u.global_name, \
              u.banner_color \
            FROM video as v \
            LEFT JOIN user as u ON u.id = v.user_id \
            WHERE v.id = ? \
      "
      )
      .get(videoId) as VideoDetails;

    if (!video) return null;
    return video;
  } catch (error) {
    console.log("videoServieces, getVideoDetails", error);
    return null;
  }
};

export const addVideo = async (
  newVideo: NewVideo,
  options: { current: boolean }
): Promise<string | null> => {
  try {
    const randomId = generateId(24);

    db.prepare(
      "\
            INSERT INTO video ( id, queue_status, video_url, video_id, title, \
                                length_seconds, thumbnail_url, user_id) \
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)\
        "
    ).run(
      randomId,
      options.current ? "current" : "next",
      newVideo.videoUrl,
      newVideo.videoId,
      newVideo.title,
      newVideo.lengthSeconds,
      newVideo.thumbnailUrl,
      newVideo.userId
    );

    return randomId;
  } catch (error: any) {
    console.log("videoServieces, addCurrentVideo", error);
    return null;
  }
};

export const getNextVideo = async (): Promise<VideoDetails | null> => {
  try {
    const nextVideo = db
      .prepare(
        "\
            SELECT * \
            FROM video \
            WHERE queue_status = 'next' \
            ORDER BY created_at ASC \
            LIMIT 1; \
        "
      )
      .get() as VideoDetails;

    if (!nextVideo) return null;
    return nextVideo;
  } catch (error: any) {
    console.log("videoServieces, getNextVideo", error);
    return null;
  }
};

export const getQueue = async ({
  queueType,
}: {
  queueType: "prev" | "next";
}): Promise<SongQueue | null> => {
  try {
    const songQueue = db
      .prepare(
        "\
            SELECT  \
              v.video_url as videoUrl, \
              v.video_id as videoId, \
              v.title, \
              v.length_seconds as lengthSeconds, \
              v.thumbnail_url as thumbnailUrl, \
              v.created_at as createdAt, \
              u.discord_id, \
              u.avatar, \
              u.global_name, \
              u.banner_color \
            FROM video as v \
            LEFT JOIN user as u ON u.id = v.user_id \
            WHERE v.queue_status = ? \
            "
      )
      .all(queueType) as SongQueue;

    if (!songQueue) return null;

    return songQueue;
  } catch (error: any) {
    console.log("videoServieces, getQueue", error);
    return null;
  }
};

export const getCurrentSong = async (): Promise<CurrentSong | null> => {
  try {
    const currentSong = db
      .prepare(
        "\
            SELECT  \
              v.video_url as videoUrl, \
              v.video_id as videoId, \
              v.title, \
              v.length_seconds as lengthSeconds, \
              v.thumbnail_url as thumbnailUrl, \
              u.discord_id, \
              u.avatar, \
              u.global_name, \
              u.banner_color \
            FROM video as v \
            LEFT JOIN user as u ON u.id = v.user_id \
            WHERE v.queue_status = ? \
            ORDER BY created_at ASC\
      "
      )
      .get("current") as CurrentSong;

    if (!currentSong) return null;

    return currentSong;
  } catch (error: any) {
    console.log("videoServieces, getCurrentSong", error);
    return null;
  }
};
