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
import {
  deleteDirectoryWithContent,
  findFilesWithExtension,
  isVideoSupported,
  listDirectories,
} from "../utils/helpers.js";
import { getUserFromSession } from "../sqlite3/userServieces.js";
import dotenv from "dotenv";
import {
  addVideo,
  changeSongStatus,
  getCurrentSong,
  getNextVideo,
  getQueue,
  getVideoDetails,
} from "../sqlite3/videoServieces.js";
import { updateStaticPath } from "../routes/index.js";

dotenv.config();

let io: Server;

let userList: SocketUser[] = [];

let prevQueue: SongQueue = await getQueue({ queueType: "prev", limit: 20 });
let nextQueue: SongQueue = await getQueue({ queueType: "next" });
let currentSong: CurrentSong = await getCurrentSong();

let fullFilePath: string = "";

let isQueueRunning: boolean = false;
let currentTimestamp = 0;

let nextSongHlsPromise: Promise<void> | null = null;

const configureSocketIO = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
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
      console.log("invalid session");
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

    mainFunction();

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
        const videoDetails = await getVideoDetailsFromYt(body.videoUrl, socket);
        if (!videoDetails) return;

        if (!isVideoSupported(videoDetails, socket)) return;

        const newVideo: NewVideo = {
          ...videoDetails,
          userId: user.id,
        };
        const nextVideoId = await getNextVideo();

        // when next queue is empty
        if (!nextVideoId && !currentSong) {
          const newVideoId = await addVideo(newVideo, { current: true });
          if (newVideoId) {
            const addedVideo: VideoDetails = await getVideoDetails(newVideoId);
            currentSong = addedVideo;
            io.emit("updateCurrentSong", currentSong);
          }
        } else {
          // when next queue is not empty
          const newVideoId = await addVideo(newVideo, { current: false });
          if (newVideoId) {
            const addedVideo: VideoDetails = await getVideoDetails(newVideoId);

            if (addedVideo) {
              nextQueue?.push(addedVideo);
              io.emit("updateNextQueue", nextQueue);
            }

            if (nextQueue?.length === 1) {
              let directories = await listDirectories("./src/song");
              let filteredFiles = await findFilesWithExtension(
                `./src/song/${nextQueue[0].videoId}`,
                ".m3u8"
              );
              if (
                !directories?.includes(nextQueue[0].videoId) &&
                !filteredFiles
              ) {
                nextSongHlsPromise = createHlsStream(
                  nextQueue[0].videoUrl,
                  nextQueue[0].videoId
                );
              } else nextSongHlsPromise = null;
            }
          }
        }
        await mainFunction();
      } catch (error) {
        console.error("socket addSong", error);
      }
    });

    // Send path to .m3u8 file
    socket.on("requestFile", async (filePath) => {
      try {
        if (fullFilePath) io.emit("updateStreamPath", fullFilePath);
        return;
      } catch (error) {
        console.error("socket requestFile", error);
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

const mainFunction = async () => {
  if (isQueueRunning) {
    return;
  }

  await deleteDirectoryWithContent({
    directoryPath: "./src/song",
    deleteDirectory: false,
  });

  await startQueue();
  isQueueRunning = false;
};

const startQueue = async (): Promise<void> => {
  isQueueRunning = true;

  if (userList.length === 0) {
    console.log("No users!");
    return;
  }

  fullFilePath = "";

  const currentSongInDb = await getCurrentSong();
  const nextSong = await getNextVideo();

  if (!currentSongInDb || !currentSong) {
    console.log("No current song");

    if (nextSong && nextQueue && nextQueue.length > 0) {
      await changeSongStatus(nextSong.id, { action: "nextToCurrent" });
      nextQueue?.shift();
      io.emit("updateNextQueue", nextQueue);

      currentSong = nextSong;
      io.emit("updateCurrentSong", currentSong);

      return startQueue();
    }

    return;
  }

  updateStaticPath(currentSong.videoId);

  if (nextSongHlsPromise) {
    console.log("Waiting for next song HLS stream creation to complete...");
    await nextSongHlsPromise;
  }

  // get all directories and current song's .m3u8 file
  let directories = await listDirectories("./src/song");
  let filteredFiles = await findFilesWithExtension(
    `./src/song/${currentSong.videoId}`,
    ".m3u8"
  );

  // create stream of current song if stream doesn't exist
  if (!directories?.includes(currentSong.videoId) && !filteredFiles) {
    io.emit("updateDownloadingState", true);
    await createHlsStream(currentSong.videoUrl, currentSong.videoId);
    io.emit("updateDownloadingState", false);
  }

  filteredFiles = await findFilesWithExtension(
    `./src/song/${currentSong.videoId}`,
    ".m3u8"
  );

  if (filteredFiles) {
    fullFilePath = `http://localhost:3000/src/song/${currentSong.videoId}/${currentSong.videoId}.m3u8`;
    io.emit("updateStreamPath", fullFilePath);
  }

  if (nextSong && nextQueue && nextQueue.length > 0) {
    nextSongHlsPromise = createHlsStream(
      nextQueue[0].videoUrl,
      nextQueue[0].videoId
    );
  } else {
    nextSongHlsPromise = null;
  }

  await songInterval(parseInt(currentSongInDb.lengthSeconds));

  if (!nextQueue || currentSong.videoId !== nextQueue[0]?.videoId) {
    await deleteDirectoryWithContent({
      directoryPath: `./src/song/${currentSong.videoId}`,
      deleteDirectory: true,
    });
  }
  await handleNextSong(currentSongInDb.id);

  updateStaticPath(undefined);
  return startQueue();
};

const handleNextSong = async (currentSongId: string) => {
  try {
    await changeSongStatus(currentSongId, { action: "currentToPrev" });

    prevQueue?.unshift(currentSong!);
    io.emit("updatePrevQueue", prevQueue);

    const nextSong = await getNextVideo();
    if (!nextSong || nextQueue?.length === 0 || nextQueue === null) {
      currentSong = null;
      io.emit("updateCurrentSong", currentSong);

      return;
    }

    await changeSongStatus(nextSong.id, { action: "nextToCurrent" });
    nextQueue?.shift();
    io.emit("updateNextQueue", nextQueue);

    currentSong = nextSong;
    io.emit("updateCurrentSong", currentSong);

    return;
  } catch (error: any) {
    console.log("Error handleNextSong:", error);
  }
};

const songInterval = async (length: number) => {
  return new Promise<void>((resolve, reject) => {
    try {
      currentTimestamp = 0;
      const intervalId = setInterval(() => {
        currentTimestamp += 1;
        if (currentTimestamp === length) {
          clearInterval(intervalId);
          currentTimestamp = 0;
          return resolve();
        }
      }, 1000);
    } catch (error: any) {
      currentTimestamp = 0;
      console.log("songInterval", error);
      return reject();
    }
  });
};

export { configureSocketIO, io };
