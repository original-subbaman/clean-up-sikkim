import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { EVENT_STATUS } from "../../utils/constants";
import { parseAndValidateEventBody } from "../../utils/helper";

const client = new DynamoDBClient({
  region: "ap-south-1",
});

// TODO: Remove organizedBy from schema and request body when integrating Cognito.
const eventSchema = z.object({
  pinId: z.string(),
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  scheduledAt: z.string(), // ISO date string
  organizedBy: z.string(),
  geohash: z.string().min(1).max(12),
  participantCount: z.number().min(0).optional(),
  maxParticipants: z.number().min(1).optional(),
  pointsAwarded: z.number().min(0).optional(),
  photoUrl: z.string().optional(),
});

export const createEventHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const parseResult = parseAndValidateEventBody(event, eventSchema);

    if (!parseResult.success) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Request body is required" }),
      };
    }

    const eventData = parseResult.data;
    const pinId = eventData.pinId;

    const isValidPinId = await client.send(
      new QueryCommand({
        TableName: "DumpPins",
        KeyConditionExpression: "pinId = :pinId",
        ExpressionAttributeValues: {
          ":pinId": pinId,
        },
      }),
    );

    if (!isValidPinId.Items || isValidPinId.Items.length === 0) {
      return {
        statusCode: 409,
        body: JSON.stringify({ message: "Invalid pinId, no such pin exists" }),
      };
    }

    const previousActiveEvent = await client.send(
      new QueryCommand({
        TableName: "Events",
        IndexName: "GSI-Pin-Events",
        KeyConditionExpression: "pinId = :pinId ",
        FilterExpression: "#status IN (:active, :inProgress, :upcoming)",
        ExpressionAttributeValues: {
          ":pinId": pinId,
          ":active": EVENT_STATUS.ACTIVE,
          ":inProgress": EVENT_STATUS.IN_PROGRESS,
          ":upcoming": EVENT_STATUS.UP_COMING,
        },
        ExpressionAttributeNames: {
          "#status": "status",
        },
      }),
    );

    if (previousActiveEvent.Items && previousActiveEvent.Items.length > 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "An active event already exists for this pin",
        }),
      };
    }

    const eventId = uuidv4();

    await client.send(
      new PutCommand({
        TableName: "Events",
        Item: {
          ...eventData,
          eventId: eventId,
          geohash4: eventData.geohash.substring(0, 4),
          geohash5: eventData.geohash.substring(0, 5),
          status: EVENT_STATUS.ACTIVE,
          createdAt: new Date().toISOString(),
        },
      }),
    );

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: "Event created successfully",
        eventId: eventId,
      }),
    };
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      statusCode: 500,
      body: JSON.stringify({ message }),
    };
  }
};
