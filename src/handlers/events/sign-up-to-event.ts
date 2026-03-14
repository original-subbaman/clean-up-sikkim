import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { eventRegistrationSchema } from "../../models/eventRegistrationSchema";
import { USER_EVENT_STATUS } from "../../utils/constants";
import { parseAndValidateEventBody } from "../../utils/helper";
import { isValidEventId, isValidUserId } from "../../utils/validation";

const baseClient = new DynamoDBClient({
  region: "ap-south-1",
});
const client = DynamoDBDocumentClient.from(baseClient);

export async function signUpToEvent(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const parseResult = parseAndValidateEventBody(
      event,
      eventRegistrationSchema,
    );

    if (!parseResult.success) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Invalid request body",
          errors: parseResult.error.issues,
        }),
      };
    }

    const { eventId, userId } = parseResult.data;

    // Validate eventId
    const eventValid = await isValidEventId(client, eventId);
    if (!eventValid) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Event not found" }),
      };
    }

    // Validate userId
    const userValid = await isValidUserId(client, userId);
    if (!userValid) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "User not found" }),
      };
    }

    // Validate if user is already registered for the event
    const existingRegistration = await client.send(
      new GetCommand({
        TableName: "EventParticipants",
        Key: { eventId, userId },
      }),
    );

    if (existingRegistration.Item) {
      return {
        statusCode: 409,
        body: JSON.stringify({
          message: "User already registered for the event",
        }),
      };
    }

    await client.send(
      new PutCommand({
        TableName: "EventParticipants",
        Item: {
          ...parseResult.data,
          status: USER_EVENT_STATUS.REGISTERED,
          registeredAt: new Date().toISOString(),
          attendedAt: null,
          pointsEarned: 0,
        },
      }),
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Event registration successful",
      }),
    };
  } catch (error) {
    console.log("🚀 ~ signUpToEvent ~ error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal server error",
        error: (error as Error).message,
      }),
    };
  }
}
