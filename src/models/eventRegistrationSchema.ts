import { z } from "zod";
import { USER_EVENT_STATUS } from "../utils/constants";

export const eventRegistrationSchema = z.object({
  eventId: z.string().min(1, "eventId is required"),
  userId: z.string().min(1, "userId is required"),
  attendedAt: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})?$/,
      "attendedAt must be a valid ISO date-time",
    )
    .optional(),
  pointsEarned: z
    .number()
    .min(0, "pointsEarned must be greater than or equal to 0")
    .optional(),
  status: z.enum(Object.values(USER_EVENT_STATUS)).optional(),
});
