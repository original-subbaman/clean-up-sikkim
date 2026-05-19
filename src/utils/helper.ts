// src/utils/parseEventBody.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { z } from "zod";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
};

export function apiResponse(
  statusCode: number,
  body: unknown,
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body),
  };
}

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
