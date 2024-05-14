import { NextFunction, Response, Request } from "express";
import { User } from "src/types";

export const isAuthenticated = (
  req: Request & User,
  res: Response,
  next: NextFunction
) => {
  if (req.user) {
    return next();
  }

  return res.status(401).json({ message: "unauthorized" });
};
