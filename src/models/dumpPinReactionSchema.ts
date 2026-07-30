import { z } from "zod";
import { PIN_REACTION } from "../utils/constants";

export const dumpPinReactionSchema = z.object({
  type: z.enum([PIN_REACTION.FLAG, PIN_REACTION.UPVOTE]),
});

export type DumpPinReactionInput = z.infer<typeof dumpPinReactionSchema>;
