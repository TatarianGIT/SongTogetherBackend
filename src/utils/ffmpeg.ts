import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import fs from "fs";
import { clearDirectory } from "./helpers.js";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export async function mergeSegments(
  videoSegment: string,
  audioSegment: string,
  output: string
) {
  await new Promise<void>(async (resolve, reject) => {
    try {
      console.log("Merge started...");
      ffmpeg()
        .input(videoSegment)
        .input(audioSegment)
        .videoCodec("copy")
        .audioCodec("copy")
        .save(output)
        .on("end", () => {
          fs.unlinkSync(videoSegment);
          fs.unlinkSync(audioSegment);
          console.log("Merge finished");
          resolve();
        })
        .on("error", (err) => {
          console.error("mergeSegments (ffmpeg) Error:", err);
          reject();
        });
    } catch (error) {
      console.error("mergeSegments error", error);
      reject();
    }
  });
}

export const convertToHls = async (videoPath: string, videoId?: string) => {
  await new Promise<void>(async (resolve, reject) => {
    await clearDirectory("./src/song/stream");

    console.log("Converting to HLS...");
    ffmpeg()
      .input(videoPath)
      .outputOptions([
        "-profile:v baseline",
        "-preset veryfast",
        "-crf 28",
        "-level 3.0",
        "-start_number 0",
        "-hls_time 4",
        "-hls_list_size 0",
        "-f hls",
      ])
      .output(`./src/song/stream/${videoId}.m3u8`)
      .on("end", async () => {
        fs.unlinkSync(videoPath);
        console.log("Conversion to HLS finished");
        resolve();
      })
      .on("error", (err) => {
        console.error("convertToHls Error:", err);
        reject();
      })
      .run();
  });
};
