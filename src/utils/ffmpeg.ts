import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import fs from "fs";

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

