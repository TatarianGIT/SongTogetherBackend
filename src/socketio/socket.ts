import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { 
  IoUserResponse, 
  SocketUser, 
} from "../types/index.js";
import { addUserToList, removeUserFromList } from "./helpers.js";
import { jwtDecode } from "jwt-decode";
import dotenv from "dotenv";

dotenv.config();

let userList: SocketUser[] = [];

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
      const sessionCookie = cookies
        .split("; ")
        .find((row) => row.startsWith("session="));
      const sessionValue = sessionCookie ? sessionCookie.split("=")[1] : null;

      const token = sessionValue;

      const decodedToken = jwtDecode<IoUserResponse>(token, { header: true });

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

    socket.on("disconnect", async () => {
      userList = await removeUserFromList(user, userList);
      io.emit("updateUserList", userList);
    });

  });
};

export default configureSocketIO;
