import { z } from "zod";
import { isInBangladesh } from "./geo";

/** Storage paths we hand out from /api/uploads/sign: photos/YYYYMM/<uuid>.jpg */
export const PHOTO_PATH_RE = /^photos\/\d{6}\/[0-9a-f-]{36}\.jpg$/;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((s) => (s ? s : undefined));

export const createToiletSchema = z
  .object({
    name: z.string().trim().min(2, "Name is too short").max(120),
    lat: z.number().finite(),
    lng: z.number().finite(),
    gender: z.enum(["male", "female", "unisex", "separate", "accessible"]),
    isPaid: z.boolean(),
    priceBdt: z.number().min(0).max(10_000).nullable().optional(),
    status: z.enum(["open", "closed"]),
    hasWater: z.boolean().optional(),
    hasSoap: z.boolean().optional(),
    babyChanging: z.boolean().optional(),
    description: optionalText(1000),
    authorName: optionalText(60),
    photoPaths: z.array(z.string().regex(PHOTO_PATH_RE)).min(1, "Add at least one photo").max(5),
    turnstileToken: z.string().min(1, "Please complete the captcha"),
  })
  .refine((v) => isInBangladesh(v), { message: "Location must be in Bangladesh", path: ["lat"] })
  .refine((v) => new Set(v.photoPaths).size === v.photoPaths.length, {
    message: "Duplicate photos",
    path: ["photoPaths"],
  });

export type CreateToiletInput = z.infer<typeof createToiletSchema>;
