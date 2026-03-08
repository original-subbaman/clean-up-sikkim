import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { z } from "zod";

const client = new DynamoDBClient({
  region: "ap-south-1",
});

const deletePinSchema = z.object({
  pinId: z.string(),
});

// TODO: Add authentication and associate reportedBy with user info from auth token instead of accepting it in request body. This will prevent impersonation and ensure data integrity.
export const deleteTrashDumpPinHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  let body;
  try {
    body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    const parseResult = deletePinSchema.safeParse(body);

    if (!parseResult.success) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Invalid request body",
          errors: parseResult.error.issues,
        }),
      };
    }

    const deletedPin = await client.send(
      new DeleteCommand({
        TableName: "DumpPins",
        Key: {
          pinId: parseResult.data.pinId,
        },
        ReturnValues: "ALL_OLD",
      }),
    );

    if (!deletedPin || !deletedPin.Attributes) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: "Pin not found",
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Trash dump pin deleted successfully",
      }),
    };
  } catch (error) {
    console.log("🚀 ~ createTrashDumpPinHandler ~ error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      statusCode: 500,
      body: JSON.stringify({ message }),
    };
  }
};
