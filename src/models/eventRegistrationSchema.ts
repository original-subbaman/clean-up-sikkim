import { z } from "zod";

export const eventRegistrationSchema = z.object({
  eventId: z.string().min(1, "eventId is required"),
  userId: z.string().min(1, "userId is required"),
});
