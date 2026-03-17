import { z } from "zod";

export const eventSchema = z.object({
  pinId: z.string(),
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  scheduledAt: z.string(), // ISO date string
  organizedBy: z.string(),
  geohash: z.string().min(1).max(12),
  participantCount: z.number().min(0).optional(),
  maxParticipants: z.number().min(1).optional(),
  pointsAwarded: z.number().min(0).optional(),
  photoUrl: z.string().optional(),
});
