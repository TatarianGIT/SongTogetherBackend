import fs, { promises } from "fs";
import ytdl, { videoInfo } from "@distube/ytdl-core";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { promisify } from "util";
import { pipeline as streamPipeline } from "stream";
import { convertToHls, mergeSegments } from "./ffmpeg.js";
import {
  sendNotificationToAll,
  sendNotificationToUser,
} from "../socketio/helpers.js";
import { Socket } from "socket.io";
import { mainDirectory } from "../envVars.js";
import { cookies } from "./cookies.js";
import { proxyList } from "./proxyList.js";

const pipeline = promisify(streamPipeline);

ffmpeg.setFfmpegPath(ffmpegPath!);

export const maxVideoDuration = 1800; // 30 mins
export const bannedWords = ["blacha", "2115", "chivas"];

export let proxyIndex = 0;
let proxy = proxyList[0];
let agent = ytdl.createProxyAgent({ uri: `http://${proxy.uri}:${proxy.port}` });

export type VideoDetails = {
  videoUrl: string;
  videoId: string;
  title: string;
  lengthSeconds: string;
  thumbnailUrl: string;
  isLive: boolean | undefined;
};

export const getVideoDetailsFromYt = async (
  videoUrl: string,
  socket?: Socket
): Promise<VideoDetails | null | undefined> => {
  let videoDetails = null;

  return await withProxy(async (): Promise<VideoDetails | undefined> => {
    try {
      const data: videoInfo = await ytdl.getInfo(videoUrl, { agent });
      const videoId = ytdl.getVideoID(videoUrl);

      const isLive = data.videoDetails.liveBroadcastDetails?.isLiveNow;
      const thumbnailUrl = data.videoDetails.thumbnails[3].url;
      const { lengthSeconds, title } = data.videoDetails;

      videoDetails = {
        videoUrl,
        videoId,
        title,
        lengthSeconds,
        thumbnailUrl,
        isLive,
      };

      console.log(`Found ${videoDetails.title} using proxy id: ${proxyIndex}`);

      if (videoDetails) return videoDetails;
    } catch (error: any) {
      console.error(
        `Proxy ${proxyIndex}. ${proxy.uri}:${proxy.port} failed with error:`,
        error
      );

      if (socket) {
        sendNotificationToUser(
          socket,
          "An error occurred!",
          "Couldn't get video details!",
          "destructive"
        );
      } else {
        sendNotificationToAll(
          "An error occurred!",
          "Couldn't get video details!",
          "destructive"
        );
      }
    }
  });
};

let isProcessing = false;

export const createHlsStream = async (url: string, videoId: string) => {
  if (isProcessing) {
    console.log("Processing already in progress. Skipping this call.");
    return;
  }

  isProcessing = true;

  try {
    console.log(`Creation of HLS stream for ${videoId} started.`);
    await promises.mkdir(`${mainDirectory}/song/${videoId}`);
    const outputFilePath = `${mainDirectory}/song/${videoId}/${videoId}.mp4`;
    const videoSegmentPath = `${mainDirectory}/song/${videoId}/video.mp4`;
    const audioSegmentPath = `${mainDirectory}/song/${videoId}/audio.mp4`;

    console.log("Downloading segments...");
    await downloadSegments(url, videoSegmentPath, audioSegmentPath);
    console.log("Merging segments...");
    await mergeSegments(videoSegmentPath, audioSegmentPath, outputFilePath);
    await convertToHls(outputFilePath, videoId);
  } catch (error: any) {
    if (error.code === "EEXIST") {
      console.log("Directory already exists: ", videoId);
    } else {
      console.error("createHlsStream", error);
      sendNotificationToAll(
        "An error occurred!",
        "Couldn't create HLS stream!",
        "destructive"
      );
    }
  } finally {
    isProcessing = false;
  }
};

const downloadSegments = async (
  url: string,
  videoSegmentPath: string,
  audioSegmentPath: string
) => {
  return await withProxy(async (): Promise<void> => {
    try {
      console.log("Getting info...");
      console.log(`Using proxy id ${proxyIndex}. ${proxy.uri}`);

      const info = await ytdl.getInfo(url, { agent });

      // const videoItagPreferences = [136, 135, 134, 133]; // 720p and lower
      const videoItagPreferences = [135, 134, 133]; // 480p and lower
      let availableItags: number[] = [];

      info.formats.forEach((format) => {
        if (videoItagPreferences.includes(format.itag)) {
          availableItags = [...availableItags, format.itag];
        }
      });

      if (availableItags.length === 0) {
        availableItags = [160];
      }

      console.log("Getting video format...");

      let videoFormat = null;
      for (const itag of availableItags) {
        videoFormat = ytdl.chooseFormat(info.formats, {
          quality: itag,
        });
        if (videoFormat) {
          break;
        }
      }

      if (!videoFormat) {
        throw new Error("No suitable video format found");
      }

      console.log("Getting audio format...");
      const audioFormat = ytdl.chooseFormat(info.formats, {
        quality: "highestaudio",
      });
      if (!audioFormat) {
        throw new Error("Audio format not found");
      }

      const videoStream = ytdl(url, { format: videoFormat });
      const audioStream = ytdl(url, { format: audioFormat });

      console.log("Getting video...");
      const videoPromise = await pipeline(
        videoStream,
        fs.createWriteStream(videoSegmentPath)
      )
        .catch(async (err: any) => {
          if (
            err instanceof Error &&
            err.message.includes("Status code: 403")
          ) {
            console.log(`Switching proxy to number ${proxyIndex}`);

            proxyIndex += 1;

            proxy = proxyList[proxyIndex];
            agent = ytdl.createProxyAgent(
              { uri: `http://${proxy.uri}:${proxy.port}` },
              cookies
            );

            await downloadSegments(url, videoSegmentPath, audioSegmentPath);
          }
          console.error("Error in video stream:", err);
        })
        .finally(() => {
          console.log("Audio segment finished");
        });

      console.log("Getting audio...");
      const audioPromise = await pipeline(
        audioStream,
        fs.createWriteStream(audioSegmentPath)
      )
        .catch(async (err: any) => {
          if (
            err instanceof Error &&
            err.message.includes("Status code: 403")
          ) {
            console.log(`Switching proxy to number ${proxyIndex}`);

            proxyIndex += 1;

            proxy = proxyList[proxyIndex];
            agent = ytdl.createProxyAgent(
              { uri: `http://${proxy.uri}:${proxy.port}` },
              cookies
            );

            await downloadSegments(url, videoSegmentPath, audioSegmentPath);
          }
          console.error("Error in audio stream:", err);
        })
        .finally(() => {
          console.log("Audio segment finished");
        });

      await Promise.all([videoPromise, audioPromise]);

      console.log("Both video and audio segments finished");
    } catch (err: any) {
      console.error("downloadSegments Error:", err.message);
    }
  });
};

async function withProxy<T>(callback: () => Promise<T>): Promise<T> {
  try {
    return await callback();
  } catch (error: any) {
    if (
      error instanceof Error &&
      (error.message.includes("Sign in to confirm you're not a bot") ||
        error.message.includes("MinigetError: Status code: 403"))
    ) {
      console.log(`Switching proxy to number ${proxyIndex}`);

      proxyIndex += 1;

      proxy = proxyList[proxyIndex];
      agent = ytdl.createProxyAgent({
        uri: `http://${proxy.uri}:${proxy.port}`,
      });

      return await callback();
    } else {
      console.error("withProxy", error);
      throw error;
    }
  }
}
