import path from "path";
import fs from "fs";

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
