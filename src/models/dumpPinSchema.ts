import { z } from "zod";

export const dumpPinSchema = z.object({
  city: z.string().min(2).max(50),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  reportedBy: z.string(),
  state: z.string().min(2).max(50),
});

export type DumpPin = z.infer<typeof dumpPinSchema>;
