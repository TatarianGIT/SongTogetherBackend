import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { IoUserResponse, SocketUser, SongQueue } from "../types/index";
import { addUserToList, removeUserFromList } from "./helpers";
import { jwtDecode } from "jwt-decode";
import { createHlsStream, getVideoDetails } from "../utils/ytdl";
import { clearDirectory, findFilesWithExtension } from "../utils/helpers";
import dotenv from "dotenv";

dotenv.config();

let userList: SocketUser[] = [];

let prevQueue: SongQueue[] = [];
let nextQueue: SongQueue[] = [];
let currentSong: SongQueue | null = null;

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

  io.use((socket, next) => {
    try {
      const cookies = socket.handshake.headers.cookie;
      const sessionCookie = cookies!
        .split("; ")
        .find((row) => row.startsWith("session="));
      const sessionValue = sessionCookie ? sessionCookie.split("=")[1] : null;

      const token = sessionValue;

      const decodedToken = jwtDecode<IoUserResponse>(token!, { header: true });

      if (decodedToken?.passport?.user !== undefined) {
        socket.data.userData = decodedToken.passport.user;
        return next();
      }
    } catch (error) {
      console.log("invalid token");
    }
  });

  io.on("connection", async (socket) => {
    const userData: SocketUser = socket.data.userData;

    const { id, avatar, banner_color, global_name } = userData;
    const user = { id, avatar, banner_color, global_name };

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
        const videoDetails = await getVideoDetails(body.videoUrl);
        const newVideo = { ...videoDetails!, addedBy: user };

        if (videoDetails !== null) {
          if (currentSong === null && nextQueue.length === 0) {
            currentSong = newVideo;
            await createHlsStream(currentSong.videoUrl, currentSong.videoId!);

            const filteredFiles = await findFilesWithExtension(
              "./src/song/stream",
              ".m3u8"
            );
            if (filteredFiles) {
              fullFilePath = `http://localhost:3000/src/song/stream/${filteredFiles}`;
              io.emit("updateStreamPath", fullFilePath);
            }

            io.emit("updateCurrentSong", currentSong);
          } else {
            nextQueue = [...nextQueue, newVideo];
            io.emit("updateNextQueue", nextQueue);
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
