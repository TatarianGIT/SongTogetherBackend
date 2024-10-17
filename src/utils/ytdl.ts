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
import { proxyAuth, proxyList } from "./proxy.js";
import { exec } from "child_process";
import util from "util";

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
    if (
      error instanceof Error &&
      (error.message.includes("403") || error.message.includes("bot"))
    ) {
      console.log(`Switching proxy to number ${proxyIndex}`);

      proxyIndex += 1;

      proxy = proxyList[proxyIndex];
      agent = ytdl.createProxyAgent({
        uri: `http://${proxy.uri}:${proxy.port}`,
      });

      return await getVideoDetailsFromYt(videoUrl);
    }

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
    await downloadSegment(url, videoId, videoSegmentPath, "video");
    await downloadSegment(url, videoId, audioSegmentPath, "audio");

    console.log("Merging segments...");
    await mergeSegments(videoSegmentPath, audioSegmentPath, outputFilePath);

    console.log("Converting to HLS stream...");
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

const execPromise = util.promisify(exec);

async function downloadSegment(
  url: string,
  videoId: string,
  path: string,
  segment?: "video" | "audio"
): Promise<void> {
  try {
    let format = "140"; // audio in medium quality

    if (segment === "video") {
      const info = await ytdl.getInfo(url, { agent });

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

      format = availableItags[0].toString();
    }

    let command = `yt-dlp -f ${format} ${videoId} \
     --proxy socks5://${proxyAuth.username}:${proxyAuth.password}@${proxy.uri}:${proxy.port} \
     -o ${path}`;

    console.log(`Executing command: ${command}`);

    const { stdout, stderr } = await execPromise(command);

    console.log("Command output:", stdout);
    if (stderr) {
      console.error("Command error output:", stderr);
    }
  } catch (error) {
    const errorMessage = (error as Error).message;

    if (errorMessage.includes("bot") || errorMessage.includes("403")) {
      console.error("Changing proxy...");

      proxyIndex += 1;
      proxy = proxyList[proxyIndex];
      agent = ytdl.createProxyAgent({
        uri: `http://${proxy.uri}:${proxy.port}`,
      });

      await downloadSegment(url, videoId, path, segment);
    } else {
      console.error("An error occurred:", errorMessage);
    }
  }
}
