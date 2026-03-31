import { z } from "zod";

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  recaptchaToken: z.string().min(1).optional(),
});

export const forgotPasswordBodySchema = z.object({
  email: z.string().email(),
  recaptchaToken: z.string().min(1),
});

export const resetPasswordBodySchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8).max(72),
  recaptchaToken: z.string().min(1).optional(),
});

