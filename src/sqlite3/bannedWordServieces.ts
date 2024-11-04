import { db } from "./db.js";

export const getBannedWordList = async (): Promise<string[] | undefined> => {
  try {
    const select = (await db
      .prepare(
        "\
          SELECT id, word \
          FROM bannedWord \
        "
      )
      .all()) as string[];

    if (!select) return undefined;

    return select;
  } catch (error) {
    console.log(`ERROR getBannedWordList: ${error}`);
  }
};

export const clearBannedWordList = async () => {
  try {
    const info = await db.prepare("DELETE FROM bannedWord").run();
    return;
  } catch (error) {
    console.log(`ERROR clearBannedWordList: ${error}`);
  }
};

export const addToBannedWordList = async (word: string) => {
  try {
    const info = await db
      .prepare("INSERT INTO bannedWord (word) VALUES (?)")
      .run(word);

    return info;
  } catch (error) {
    console.log(`ERROR addToBannedWordList: ${error}`);
  }

  return;
};
