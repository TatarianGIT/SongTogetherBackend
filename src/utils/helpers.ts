import path from "path";
import fs from "fs";
import { bannedWords, maxVideoDuration } from "./ytdl.js";

export const clearDirectory = async (directory: string) => {
  try {
    const files = await fs.promises.readdir(directory);
    const unlinkPromises = files.map((file) =>
      fs.promises.unlink(path.join(directory, file))
    );
    await Promise.all(unlinkPromises);
  } catch (error) {
    console.error("clearDirectory", error);
  }
};

export const findFilesWithExtension = async (
  dir: string,
  ext: string
): Promise<string | null> => {
  try {
    const files = await fs.promises.readdir(dir);
    const filteredFiles = files.filter((file) => path.extname(file) === ext);
    return filteredFiles[0];
  } catch (err) {
    console.log("findFilesWithExtension", err);
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

