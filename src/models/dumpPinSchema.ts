import { z } from "zod";

export const dumpPinSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  city: z.string().min(2).max(50),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  photoUrls: z.array(z.url()).optional(),
});

export type DumpPin = z.infer<typeof dumpPinSchema>;
