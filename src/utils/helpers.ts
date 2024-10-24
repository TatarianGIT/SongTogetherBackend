import path, { dirname } from "path";
import fs from "fs";
import { Socket } from "socket.io";
import { sendNotificationToUser } from "../socketio/helpers.js";
import { bannedWords, maxVideoDuration } from "./ytdl.js";
import { mainDirectory } from "../envVars.js";
import { SongQueue } from "../types/index.js";

export async function deleteDirectoryWithContent({
  directoryPath,
  deleteDirectory,
}: {
  directoryPath: string;
  deleteDirectory: boolean;
}): Promise<void> {
  try {
    await fs.promises.access(directoryPath);

    const files = await fs.promises.readdir(directoryPath);

    for (const file of files) {
      const currentPath = path.join(directoryPath, file);
      const stats = await fs.promises.lstat(currentPath);

      if (stats.isDirectory()) {
        await deleteDirectoryWithContent({
          directoryPath: currentPath,
          deleteDirectory: true,
        });
      } else {
        await fs.promises.unlink(currentPath);
      }
    }

    if (deleteDirectory === true) {
      await fs.promises.rmdir(directoryPath);
    }
  } catch (err: any) {
    if (err.code === "ENOENT") {
      console.log(`Directory not found: ${directoryPath}`);
    } else {
      throw err;
    }
  }
}

export const findFilesWithExtension = async (
  dir: string,
  ext: string
): Promise<string[] | null> => {
  try {
    await fs.promises.access(dir, fs.constants.F_OK);

    const files = await fs.promises.readdir(dir);

    const filteredFiles = files.filter((file) => path.extname(file) === ext);

    return filteredFiles;
  } catch (err: any) {
    if (err.code === "ENOENT") {
      console.log(`Directory does not exist: ${dir}`);
    } else {
      console.log("findFilesWithExtension error:", err);
    }
    return null;
  }
};

export const listDirectories = async (
  dir: string
): Promise<string[] | null> => {
  try {
    const directories = await fs.promises.readdir(dir);
    return directories;
  } catch (err) {
    console.log("listDirectories", err);
    return null;
  }
};

export const isBannedWordInTitle = (
  title: string,
  bannedWords: string[]
): string | undefined => {
  const lowerCaseTitle = title.toLocaleLowerCase();
  let returnedWord: string | undefined;

  bannedWords.some((word) =>
    lowerCaseTitle.includes(word.toLocaleLowerCase())
      ? (returnedWord = word)
      : (returnedWord = undefined)
  );

  if (returnedWord) {
    return returnedWord;
  } else return undefined;
};

export const isVideoTooLong = (
  lengthSeconds: string,
  maxVideoLength: number
): boolean => {
  const videoLength = parseInt(lengthSeconds);

  return videoLength > maxVideoLength;
};

export const isAlreadyInQueue = async (
  videoTitle: string,
  nextQueue: SongQueue
): Promise<boolean> => {
  if (!nextQueue) return false;

  if (nextQueue.some((song) => song.title === videoTitle)) {
    return true;
  }

  return false;
};

type getVideoDetails = {
  videoUrl: string;
  videoId: string;
  title: string;
  lengthSeconds: string;
  thumbnailUrl: string;
  isLive: boolean | undefined;
};

export const isVideoSupported = async (
  videoDetails: getVideoDetails,
  nextQueue: SongQueue,
  socket: Socket
): Promise<boolean> => {
  if (videoDetails.isLive) {
    console.log("Livestream cannot be added");
    sendNotificationToUser(
      socket,
      "You can't add live steams!",
      "Live broadcasts are not supported!",
      "destructive"
    );
    return false;
  }

  if (await isAlreadyInQueue(videoDetails.title, nextQueue)) {
    console.log("Video already in the queue!", videoDetails.title);
    sendNotificationToUser(
      socket,
      "Already in queue!",
      "Video exists in next queue.",
      "destructive"
    );
    return false;
  }

  if (await isVideoTooLong(videoDetails.lengthSeconds, maxVideoDuration)) {
    console.log("Video is too long!", videoDetails.lengthSeconds);
    sendNotificationToUser(
      socket,
      "An error occurred!",
      "Video is too long, maximum allowed length is 30 minutes!",
      "destructive"
    );
    return false;
  }

  const returnedWord = isBannedWordInTitle(videoDetails.title, bannedWords);

  if (returnedWord) {
    console.log(`Video contains banned words: ${returnedWord}`);
    sendNotificationToUser(
      socket,
      "You can't add this video!",
      `Video contains banned words: ${returnedWord}.`,
      "destructive"
    );
    return false;
  }

  return true;
};

export const getStreamPath = (videoPath: string) => {
  const newMainDir = dirname(mainDirectory);
  let result = videoPath.substring(newMainDir.length);
  return result;
};
