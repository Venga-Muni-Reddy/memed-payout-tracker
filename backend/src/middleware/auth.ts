import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { HttpError } from "../utils/errors";

export type Role = "brand" | "creator";
export interface AuthUser {
  id: string;
  role: Role;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, config.jwtSecret, { expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"] });
}

/** Requires a valid `Authorization: Bearer <jwt>` header. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw new HttpError(401, "Missing or malformed Authorization header.");
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as AuthUser;
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch {
    throw new HttpError(401, "Invalid or expired token.");
  }
}

/** Restricts a route to one role. Use after requireAuth. */
export function requireRole(role: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.user?.role !== role) throw new HttpError(403, `Only ${role} accounts can do this.`);
    next();
  };
}
