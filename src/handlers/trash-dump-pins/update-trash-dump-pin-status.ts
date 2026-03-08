import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { z } from "zod";

const client = new DynamoDBClient({
  region: "ap-south-1",
});

const updatePinSchema = z.object({
  pinId: z.string(),
  status: z.string(),
});

// TODO: Add authentication and associate reportedBy with user info from auth token instead of accepting it in request body. This will prevent impersonation and ensure data integrity.
// TODO: Add validation for status field to only allow specific values (e.g., "reported", "in_progress", "resolved") to maintain data integrity.
export const updateTrashDumpPinStatusHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  let body;
  try {
    body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    const parseResult = updatePinSchema.safeParse(body);

    if (!parseResult.success) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Invalid request body",
          errors: parseResult.error.issues,
        }),
      };
    }

    const { pinId, status } = parseResult.data;

    const result = await client.send(
      new UpdateCommand({
        TableName: "DumpPins",
        Key: { pinId: pinId },
        UpdateExpression: "SET #status = :status",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":status": status },
        ReturnValues: "ALL_NEW",
      }),
    );

    if (!result.Attributes) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Pin not found" }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Dump pin status updated successfully",
        pinId,
      }),
    };
  } catch (error) {
    console.log("🚀 ~ updateTrashDumpPinHandler ~ error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      statusCode: 500,
      body: JSON.stringify({ message }),
    };
  }
};
