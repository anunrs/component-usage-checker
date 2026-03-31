// JWT auth middleware
// Runs before any protected route. Reads the token from the Authorization header,
// verifies it is valid and not expired, then attaches the userId to the request object
// so route handlers can know who is making the request.

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  userId?: string;
}

export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // expects: "Bearer <token>"

  if (!token) {
    res.status(401).json({ error: "No token provided" });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    req.userId = payload.userId;
    next();
  } catch {
    res.status(403).json({ error: "Invalid or expired token" });
  }
}
