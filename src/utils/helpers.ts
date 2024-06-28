import path from "path";
import fs from "fs";

export const clearDirectory = async (directory: string) => {
  for (const file of fs.readdirSync(directory)) {
    fs.unlinkSync(path.join(directory, file));
  }
};
