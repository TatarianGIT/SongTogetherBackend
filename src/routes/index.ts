import { Router } from "express";
import AuthRoute from "./auth.js";
import SongRoute from "./song.js";
import { isAuthenticated } from "../middleware/isAuthenticated.js";

const MainRoute = Router();

MainRoute.use("/auth", AuthRoute);
MainRoute.use("/song", isAuthenticated, SongRoute);

export default MainRoute;
