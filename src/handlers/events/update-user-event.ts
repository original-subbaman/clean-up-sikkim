import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { eventRegistrationSchema } from "../../models/eventRegistrationSchema";
import { parseAndValidateEventBody } from "../../utils/helper";

const baseClient = new DynamoDBClient({
  region: "ap-south-1",
});
const client = DynamoDBDocumentClient.from(baseClient);

export async function updateUserEvent(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const eventsParticipantsTable = process.env.EVENT_PARTICIPANTS_TABLE;
    const eventId = event.pathParameters?.eventId;
    const userId = event.pathParameters?.userId;

    if (!eventId || !userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Missing eventId or userId in path parameters",
        }),
      };
    }

    const updateSchema = eventRegistrationSchema.omit({
      userId: true,
      eventId: true,
    });

    const parsedResult = parseAndValidateEventBody(event, updateSchema);
    if (!parsedResult.success) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Invalid request body",
          errors: parsedResult.error.issues,
        }),
      };
    }

    const updateFields: string[] = [];
    const expressionAttributeValues: Record<
      string,
      string | number | undefined
    > = {};
    const expressionAttributeNames: Record<string, string> = {};

    if (parsedResult.data.attendedAt !== undefined) {
      updateFields.push("attendedAt = :attendedAt");
      expressionAttributeValues[":attendedAt"] = parsedResult.data.attendedAt;
    }
    if (parsedResult.data.pointsEarned !== undefined) {
      updateFields.push("pointsEarned = :pointsEarned");
      expressionAttributeValues[":pointsEarned"] =
        parsedResult.data.pointsEarned;
    }
    if (parsedResult.data.status !== undefined) {
      updateFields.push("#status = :status");
      expressionAttributeValues[":status"] = parsedResult.data.status;
      expressionAttributeNames["#status"] = "status";
    }

    await client.send(
      new UpdateCommand({
        TableName: eventsParticipantsTable,
        Key: { eventId, userId },
        UpdateExpression: "SET " + updateFields.join(", "),
        ExpressionAttributeNames: Object.keys(expressionAttributeNames).length
          ? expressionAttributeNames
          : undefined,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression:
          "attribute_exists(eventId) AND attribute_exists(userId)",
      }),
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "User event updated successfully" }),
    };
  } catch (error) {
    console.log("🚀 ~ updateUserEvent ~ error:", error);
    if (
      error instanceof Error &&
      error.name === "ConditionalCheckFailedException"
    ) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Record does not exist" }),
      };
    }
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
}
