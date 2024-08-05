import { NextFunction, Response, Request } from "express";
import { User } from "../types";

export const isAuthenticated = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.user) {
    return next();
  }

  return res.status(401).json({ message: "unauthorized" });
};
