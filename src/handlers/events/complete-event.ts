import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  QueryCommandOutput,
  TransactWriteCommand,
  TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import crypto from "crypto";
import { Event } from "../../models/eventSchema";
import {
  EVENT_STATUS,
  PIN_STATUS,
  USER_EVENT_STATUS,
} from "../../utils/constants";

const baseClient = new DynamoDBClient({
  region: "ap-south-1",
});

const client = DynamoDBDocumentClient.from(baseClient);
const MAX_PARTICIPANTS_PER_EVENT = 49;
/**
 * TODOs for completeEvent:
 * 1. Move points check before DB fetch
 * 2. Reorder: validate, auth, then DB
 * 3. Update completeEvent logic for security
 */
export async function completeEvent(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const eventId = event.pathParameters?.eventId;
    // const organizerId = event.requestContext.authorizer?.claims?.sub;
    const organizerId = "user_xyz789"; // Placeholder for testing
    if (!eventId || !organizerId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid request" }),
      };
    }

    const completedEvent = await getEvent(client, eventId);
    if (!completedEvent) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Event not found" }),
      };
    }

    if (completedEvent.status === EVENT_STATUS.COMPLETED) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Event is already completed" }),
      };
    }

    if (completedEvent.organizedBy !== organizerId) {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: "Unauthorized" }),
      };
    }
    const pointsToAward = completedEvent.pointsAwarded || 0;

    const participants = await fetchUsersWhoAttendedEvent(client, eventId);

    if (participants.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "No participants attended the event" }),
      };
    }

    if (participants.length > MAX_PARTICIPANTS_PER_EVENT) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Too many participants to process in a single transaction",
        }),
      };
    }

    if (pointsToAward <= 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Event has no points configured" }),
      };
    }

    const date = new Date().toISOString();
    const transactItems: TransactWriteCommandInput["TransactItems"] =
      participants.flatMap((userId) => [
        // 1. Append to the ledger
        {
          Put: {
            TableName: "PointTransactions",
            Item: {
              userId,
              txnId: `${date}#${crypto.randomUUID()}`,
              type: "CLEANUP_ATTENDED",
              points: pointsToAward,
              referenceId: eventId,
              createdAt: date,
            },
            ConditionExpression: "attribute_not_exists(txnId)",
          },
        },
        // 2. Increment the running total on the user
        {
          Update: {
            TableName: "Users",
            Key: { userId },
            UpdateExpression: "ADD totalPoints :pts, cleanupCount :one",
            ExpressionAttributeValues: {
              ":pts": pointsToAward,
              ":one": 1,
            },
          },
        },
      ]);
    // update event status to COMPLETED
    transactItems.push({
      Update: {
        TableName: "Events",
        Key: { eventId },
        UpdateExpression:
          "SET #status = :completed, completedAt = :completedAt",
        ConditionExpression: "#status <> :completed",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":completed": EVENT_STATUS.COMPLETED,
          ":completedAt": date,
        },
      },
    });
    // update dump pins status
    transactItems.push({
      Update: {
        TableName: "DumpPins",
        Key: { pinId: completedEvent.pinId },
        UpdateExpression: "SET #status = :closed",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":closed": PIN_STATUS.CLOSED,
        },
      },
    });

    await client.send(
      new TransactWriteCommand({ TransactItems: transactItems }),
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Event completed successfully",
        participantsAwarded: participants.length,
        pointsEach: pointsToAward,
        totalPointsAwarded: participants.length * pointsToAward,
      }),
    };
  } catch (error) {
    console.log("🚀 ~ completeEvent ~ error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      statusCode: 500,
      body: JSON.stringify({ message }),
    };
  }
}

async function getEvent(
  client: DynamoDBDocumentClient,
  eventId: string,
): Promise<Event | null> {
  const result = await client.send(
    new GetCommand({
      TableName: "Events",
      Key: { eventId },
    }),
  );
  // Return the first matching event object or null
  return (result.Item as Event) ?? null;
}

async function fetchUsersWhoAttendedEvent(
  client: DynamoDBDocumentClient,
  eventId: string,
): Promise<string[]> {
  const userIds: string[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined = undefined;

  do {
    const result: QueryCommandOutput = await client.send(
      new QueryCommand({
        TableName: "EventParticipants",
        KeyConditionExpression: "eventId = :eventId",
        FilterExpression: "#status = :attendedStatus",
        ExpressionAttributeValues: {
          ":eventId": eventId,
          ":attendedStatus": USER_EVENT_STATUS.ATTENDED,
        },
        ExpressionAttributeNames: { "#status": "status" },
        ExclusiveStartKey: lastEvaluatedKey,
      }),
    );

    result.Items?.forEach((item) => userIds.push(item.userId as string));
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return userIds;
}
