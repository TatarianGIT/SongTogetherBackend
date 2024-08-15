import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import type {
  CurrentSong,
  DatabaseUser,
  NewVideo,
  SocketUser,
  SongQueue,
  VideoDetails,
} from "../types/index.js";
import { addUserToList, removeUserFromList } from "./helpers.js";
import { createHlsStream, getVideoDetailsFromYt } from "../utils/ytdl.js";
import { clearDirectory, findFilesWithExtension } from "../utils/helpers.js";
import { getUserFromSession } from "../sqlite3/userServieces.js";
import dotenv from "dotenv";
import {
  addVideo,
  getCurrentSong,
  getNextVideo,
  getQueue,
  getVideoDetails,
} from "../sqlite3/videoServieces.js";

dotenv.config();

let userList: SocketUser[] = [];

let prevQueue: SongQueue = await getQueue({ queueType: "prev" });
let nextQueue: SongQueue = await getQueue({ queueType: "next" });
let currentSong: CurrentSong = await getCurrentSong();

let isProcessing: boolean = false;
let fullFilePath: string = "";

const configureSocketIO = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const cookies = socket.handshake.headers.cookie;

      const sessionCookie = cookies!
        .split("; ")
        .find((row) => row.startsWith("auth_session="));
      const sessionId = sessionCookie ? sessionCookie.split("=")[1] : null;

      if (sessionId) {
        const user: DatabaseUser | null = await getUserFromSession(sessionId);
        if (user) {
          socket.data.userData = user;
          return next();
        }
      }
    } catch (error) {
      console.log("invalid token");
    }
  });

  io.on("connection", async (socket) => {
    const userData: DatabaseUser = socket.data.userData;

    const { discord_id, avatar, banner_color, global_name, id } = userData;
    const user: SocketUser = {
      discord_id,
      avatar,
      banner_color,
      global_name,
      id,
    };

    userList = await addUserToList(user, userList);
    io.emit("updateUserList", userList);

    socket.on("getUserList", async () => {
      io.emit("updateUserList", userList);
    });

    socket.on("disconnect", async () => {
      userList = await removeUserFromList(user, userList);
      io.emit("updateUserList", userList);
    });

    // Adding new song
    socket.on("addSong", async (body: { videoUrl: string }) => {
      try {
        const videoDetails = await getVideoDetailsFromYt(body.videoUrl);

        if (videoDetails) {
          const newVideo: NewVideo = {
            ...videoDetails,
            userId: user.id,
          };
          const nextVideoId = await getNextVideo();

          // when next queue is empty
          if (!nextVideoId && !currentSong) {
            const newVideoId = await addVideo(newVideo, { current: true });
            console.log("newVideoId", newVideoId);
            if (newVideoId) {
              const addedVideo: VideoDetails = await getVideoDetails(
                newVideoId
              );
              console.log("addedVideo", addedVideo);

              if (addedVideo) {
                currentSong = addedVideo;
                console.log("currentSong", currentSong);

                await createHlsStream(
                  currentSong.videoUrl,
                  currentSong.videoId
                );

                const filteredFiles = await findFilesWithExtension(
                  "./src/song/stream",
                  ".m3u8"
                );

                if (filteredFiles) {
                  fullFilePath = `http://localhost:3000/src/song/stream/${filteredFiles}`;
                  io.emit("updateStreamPath", fullFilePath);
                }

                io.emit("updateCurrentSong", currentSong);
              }
            }
          } else {
            // when next queue is not empty
            console.log("11");
            const newVideoId = await addVideo(newVideo, { current: false });
            console.log("22");
            console.log("newVideoId", newVideoId);
            if (newVideoId) {
              console.log("33");
              const addedVideo: VideoDetails = await getVideoDetails(
                newVideoId
              );
              console.log("addedVideo", addedVideo);

              if (addedVideo) {
                console.log("44");
                nextQueue?.push(addedVideo);
                console.log("nextQueue", nextQueue);
                io.emit("updateNextQueue", nextQueue);
                console.log("donee");
              }
            }
          }
        }
      } catch (error) {
        console.error("socket addSong", error);
      }
    });

    // Send path to .m3u8 file
    socket.on("requestFile", async (filePath) => {
      try {
        const filteredFiles = await findFilesWithExtension(
          "./src/song/stream",
          ".m3u8"
        );
        fullFilePath = `http://localhost:3000/src/song/stream/${filteredFiles}`;
      } catch (error) {
        console.error("socket requestFile", error);
      } finally {
        io.emit("updateStreamPath", fullFilePath);
        fullFilePath = "";
      }
    });

    // nextsong
    socket.on("videoEnd", async (currentVideoId: string) => {
      if (isProcessing) {
        return;
      }

      try {
        isProcessing = true;

        await clearDirectory("./src/song/stream");

        prevQueue = [...prevQueue, currentSong];

        if (nextQueue.length > 0) {
          currentSong = nextQueue[0];
          nextQueue.shift();
          await createHlsStream(currentSong!.videoUrl, currentSong!.videoId!);
        } else {
          currentSong = null;
        }

        const filteredFiles = await findFilesWithExtension(
          "./src/song/stream",
          ".m3u8"
        );

        if (filteredFiles) {
          fullFilePath = `http://localhost:3000/src/song/stream/${filteredFiles}`;
        } else {
          fullFilePath = "";
        }
      } catch (error) {
        console.log("socket videoEnd", error);
      } finally {
        io.emit("updateNextQueue", nextQueue);
        io.emit("updateStreamPath", fullFilePath);
        io.emit("updateCurrentSong", currentSong);
        io.emit("updatePrevQueue", prevQueue);
        fullFilePath = "";
        isProcessing = false;
      }
    });

    // Sending previous song queue to frontend
    socket.on("getPrevQueue", () => {
      try {
        io.emit("updatePrevQueue", prevQueue);
      } catch (error) {
        console.error("socket getPrevQueue", error);
      }
    });

    // Sending current song to frontend
    socket.on("getCurrentSong", () => {
      try {
        io.emit("updateCurrentSong", currentSong);
      } catch (error) {
        console.error("socket getCurrentSong", error);
      }
    });

    // Sending next song queue to frontend
    socket.on("getNextQueue", () => {
      try {
        io.emit("updateNextQueue", nextQueue);
      } catch (error) {
        console.error("socket getNextQueue", error);
      }
    });
  });
};

export default configureSocketIO;
