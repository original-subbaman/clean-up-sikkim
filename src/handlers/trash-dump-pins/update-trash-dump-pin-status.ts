import { apiResponse } from "../../utils/helper";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { z } from "zod";
import { PIN_STATUS } from "../../utils/constants";
const client = new DynamoDBClient({
  region: "ap-south-1",
});
const updatePinSchema = z.object({
  pinId: z.string(),
  status: z.enum([
    PIN_STATUS.REPORTED,
    PIN_STATUS.VERIFIED,
    PIN_STATUS.CLEANED,
    PIN_STATUS.CLEANUP_SCHEDULED,
  ]),
});
// TODO: Add validation for status field to only allow specific values (e.g., "reported", "in_progress", "resolved") to maintain data integrity.
export const updateTrashDumpPinStatusHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  let body;
  const dumpPinsTable = process.env.DUMP_PINS_TABLE;
  try {
    body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    const parseResult = updatePinSchema.safeParse(body);
    if (!parseResult.success) {
      return apiResponse(400, {
        message: "Invalid request body",
        errors: parseResult.error.issues,
      });
    }
    const { pinId, status } = parseResult.data;
    const result = await client.send(
      new UpdateCommand({
        TableName: dumpPinsTable,
        Key: { pinId: pinId },
        UpdateExpression: "SET #status = :status",
        ExpressionAttributeNames: { "#status": "status" },
        ConditionExpression: "attribute_exists(pinId)",
        ExpressionAttributeValues: { ":status": status },
        ReturnValues: "ALL_NEW",
      }),
    );
    if (!result.Attributes) {
      return apiResponse(404, { message: "Pin not found" });
    }
    return apiResponse(200, {
      message: "Dump pin status updated successfully",
      pinId,
    });
  } catch (error) {
    console.log("🚀 ~ updateTrashDumpPinStatusHandler ~ error:", error);
    if (
      error instanceof Error &&
      error.name === "ConditionalCheckFailedException"
    ) {
      return apiResponse(404, { message: "Pin not found" });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return apiResponse(500, { message });
  }
};
