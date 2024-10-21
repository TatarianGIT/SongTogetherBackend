import { NextFunction, Response, Request } from "express";
import { AuthRole } from "../types/index.js";

export const isAuthenticated = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!res.locals.user) {
    return res.status(401).end();
  }
  next();
};

