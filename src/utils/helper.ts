// src/utils/parseEventBody.ts
import { APIGatewayProxyEvent } from "aws-lambda";
import { z } from "zod";

/**
 * Parses and validates the body of an API Gateway event using a Zod schema.
 * Returns the Zod parse result (success or error).
 *
 * @param {APIGatewayProxyEvent} event - The API Gateway event containing the body.
 * @param {z.ZodSchema<T>} schema - The Zod schema to validate against.
 * @returns {z.SafeParseReturnType<T, T>} The Zod parse result.
 */
export function parseAndValidateEventBody<T>(
  event: APIGatewayProxyEvent,
  schema: z.ZodSchema<T>,
): ReturnType<typeof schema.safeParse> {
  if (!event.body) {
    return schema.safeParse(undefined);
  }
  let parsed;
  try {
    parsed =
      typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  } catch {
    return schema.safeParse(undefined);
  }
  return schema.safeParse(parsed);
}
