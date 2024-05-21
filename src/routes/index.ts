import { Router } from "express";
import AuthRoute from "./auth.js";

const MainRoute = Router();

// Workaround of an error caused by PassportJS
MainRoute.use(function (request, response, next) {
  if (request.session && !request.session.regenerate) {
    request.session.regenerate = (cb) => {
      cb();
    };
  }
  if (request.session && !request.session.save) {
    request.session.save = (cb) => {
      cb();
    };
  }
  next();
});

MainRoute.use("/auth", AuthRoute);

export default MainRoute;
