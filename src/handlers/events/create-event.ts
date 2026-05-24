import { apiResponse } from "../../utils/helper";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import ngeohash from "ngeohash";
import { v4 as uuidv4 } from "uuid";
import { eventSchema } from "../../models/eventSchema";
import { EVENT_STATUS } from "../../utils/constants";
import { parseAndValidateEventBody } from "../../utils/helper";
const client = new DynamoDBClient({
  region: "ap-south-1",
});

export const createEventHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const eventsTable = process.env.EVENTS_TABLE;
    const dumpPinsTable = process.env.DUMP_PINS_TABLE;
    const parseResult = parseAndValidateEventBody(event, eventSchema);
    if (!parseResult.success) {
      const fields = parseResult.error.issues.map((issue) => ({
        field: issue.path.length > 0 ? issue.path.join(".") : "body",
        message: issue.message,
      }));

      return apiResponse(400, {
        message: "Invalid request body",
        fields,
      });
    }
    const eventData = parseResult.data;
    const pinId = eventData.pinId;
    const organizeBy = event.requestContext.authorizer?.claims?.sub;

    const isValidPinId = await client.send(
      new QueryCommand({
        TableName: dumpPinsTable,
        KeyConditionExpression: "pinId = :pinId",
        ExpressionAttributeValues: {
          ":pinId": pinId,
        },
      }),
    );

    if (!isValidPinId.Items || isValidPinId.Items.length === 0) {
      return apiResponse(409, { message: "Invalid pinId, no such pin exists" });
    }

    const previousActiveEvent = await client.send(
      new QueryCommand({
        TableName: eventsTable,
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
      return apiResponse(400, {
        message: "An active event already exists for this pin",
      });
    }
    const eventId = uuidv4();
    const geohash = ngeohash.encode(eventData.lat, eventData.lng, 6);
    await client.send(
      new PutCommand({
        TableName: eventsTable,
        Item: {
          ...eventData,
          organizeBy: organizeBy,
          eventId: eventId,
          geohash: geohash,
          geohash4: geohash.substring(0, 4),
          geohash5: geohash.substring(0, 5),
          status: EVENT_STATUS.ACTIVE,
          createdAt: new Date().toISOString(),
        },
      }),
    );
    return apiResponse(201, {
      message: "Event created successfully",
      eventId: eventId,
    });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return apiResponse(500, { message });
  }
};
