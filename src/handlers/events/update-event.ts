import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { parseAndValidateEventBody } from "../../utils/helper";
import { eventSchema } from "../../models/eventSchema";
import { EVENT_STATUS } from "../../utils/constants";

const baseClient = new DynamoDBClient({
  region: "ap-south-1",
});
const client = DynamoDBDocumentClient.from(baseClient);

const allowedUpdateFields: string[] = [
  "name",
  "description",
  "scheduledAt",
  "maxParticipants",
  "pointsAwarded",
  "photoUrl",
  "status",
];

export async function updateEvent(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const eventsTable = process.env.EVENTS_TABLE;
    const eventId = event.pathParameters?.eventId;
    if (!eventId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "eventId is required in path parameters",
        }),
      };
    }

    // Validate request body
    const parseResult = parseAndValidateEventBody(event, eventSchema.partial());
    if (!parseResult.success) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid request body" }),
      };
    }
    const updateData: Record<string, any> = parseResult.data;

    // Filter only allowed fields
    const fieldsToUpdate = Object.keys(updateData).filter((key) =>
      allowedUpdateFields.includes(key),
    );
    if (fieldsToUpdate.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "No valid fields to update" }),
      };
    }

    // Build UpdateExpression and ExpressionAttributeValues
    const updateExpression =
      "SET " +
      fieldsToUpdate.map((field, idx) => `#${field} = :${field}`).join(", ");
    const expressionAttributeNames = fieldsToUpdate.reduce(
      (acc, field) => {
        acc[`#${field}`] = field;
        return acc;
      },
      {} as Record<string, string>,
    );
    const expressionAttributeValues = fieldsToUpdate.reduce(
      (acc, field) => {
        acc[`:${field}`] = updateData[field];
        return acc;
      },
      {} as Record<string, any>,
    );

    await client.send(
      new UpdateCommand({
        TableName: eventsTable,
        Key: { eventId },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: "UPDATED_NEW",
      }),
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Event ${eventId} updated successfully`,
        updatedFields: fieldsToUpdate,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
}
