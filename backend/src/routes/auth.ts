import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "../models/User";
import { requireAuth, signToken } from "../middleware/auth";
import { HttpError } from "../utils/errors";

export const authRouter = Router();

const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
  role: z.enum(["brand", "creator"]),
});
const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1) });

const publicUser = (u: any) => ({ id: String(u._id), name: u.name, email: u.email, role: u.role });

authRouter.post("/signup", async (req, res) => {
  const body = signupSchema.parse(req.body);
  const exists = await User.findOne({ email: body.email.toLowerCase() });
  if (exists) throw new HttpError(409, "An account with this email already exists.");
  const user = await User.create({
    name: body.name,
    email: body.email,
    role: body.role,
    passwordHash: await bcrypt.hash(body.password, 10),
  });
  res.status(201).json({ token: signToken({ id: user.id, role: user.role }), user: publicUser(user) });
});

authRouter.post("/login", async (req, res) => {
  const body = loginSchema.parse(req.body);
  const user = await User.findOne({ email: body.email.toLowerCase() });
  // Same message for unknown email and wrong password so accounts cannot be probed.
  if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) throw new HttpError(401, "Invalid email or password.");
  res.json({ token: signToken({ id: user.id, role: user.role }), user: publicUser(user) });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.user!.id);
  if (!user) throw new HttpError(401, "Account no longer exists.");
  res.json({ user: publicUser(user) });
});
