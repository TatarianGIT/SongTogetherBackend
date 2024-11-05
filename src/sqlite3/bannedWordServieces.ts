import { db } from "./db.js";

type BannedWord = {
  id: number;
  word: string;
};

export const getBannedWordList = async (): Promise<
  BannedWord[] | undefined
> => {
  try {
    const select = (await db
      .prepare(
        "\
          SELECT id, word \
          FROM bannedWord \
        "
      )
      .all()) as BannedWord[];

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
