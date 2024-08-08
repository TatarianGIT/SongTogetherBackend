import { asc, eq } from "drizzle-orm";
import { SongQueue } from "../types";
import { db } from "./db.js";
import { VideoList } from "./schema.js";

export const addNewVideo = async (newVideo: SongQueue, isCurrent?: boolean) => {
  try {
    if (newVideo)
      return await db
        .insert(VideoList)
        .values({
          title: newVideo.title,
          addedBy: newVideo.addedBy.global_name,
          lengthSeconds: newVideo.lengthSeconds,
          thumbnailUrl: newVideo.thumbnailUrl,
          videoId: newVideo.videoId,
          videoUrl: newVideo.videoUrl,
          ...(isCurrent ? { type: "current" } : { type: "next" }),
        })
        .returning({
          title: VideoList.title,
          addedBy: VideoList.addedBy,
          lengthSeconds: VideoList.lengthSeconds,
          thumbnailUrl: VideoList.thumbnailUrl,
          videoId: VideoList.videoId,
          videoUrl: VideoList.videoId,
        });
  } catch (error) {
    console.log("videoServieces, addNewVideo:", error);
    return null;
  }
};

export async function getNextVideoId() {
  try {
    const oldestVideo = await db
      .select()
      .from(VideoList)
      .where(eq(VideoList.type, "next"))
      .orderBy(asc(VideoList.timestamp))
      .limit(1);
    return oldestVideo[0].id;
  } catch (error) {
    console.log("videoServieces, getNextVideoId:", error);
    return null;
  }
}

export const getCurrentVideoId = async () => {
  try {
    const currentVideo = await db
      .select()
      .from(VideoList)
      .where(eq(VideoList.type, "current"));

    return currentVideo[0].id;
  } catch (error) {
    console.log("videoServieces, getCurrentVideoId:", error);
    return null;
  }
};

export const getNextQueue = async () => {
  try {
    return await db.select().from(VideoList);
  } catch (error) {
    console.log("videoServieces, getNextQueue:", error);
    return null;
  }
};
