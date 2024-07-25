import path from "path";
import fs from "fs";

export const clearDirectory = async (directory: string) => {
  for (const file of fs.readdirSync(directory)) {
    fs.unlinkSync(path.join(directory, file));
  }
};

export const findFilesWithExtension = async (
  dir: string,
  ext: string
): Promise<{ filteredFiles: string[] } | null> => {
  try {
    const files = await fs.promises.readdir(dir);
    const filteredFiles = files.filter((file) => path.extname(file) === ext);
    return { filteredFiles };
  } catch (err) {
    console.log("findFilesWithExtension", err);
    return null;
  }
};
