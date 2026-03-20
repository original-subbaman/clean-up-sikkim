import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  BatchGetCommand,
} from "@aws-sdk/lib-dynamodb";

const baseClient = new DynamoDBClient({
  region: "ap-south-1",
});
const client = DynamoDBDocumentClient.from(baseClient);

export async function getEventById(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const eventId = event.pathParameters?.eventId;
    if (!eventId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Event ID is required" }),
      };
    }

    const [eventDetails, participantsResult] = await Promise.all([
      client.send(
        new GetCommand({
          TableName: "Events",
          Key: { eventId },
        }),
      ),
      client.send(
        new QueryCommand({
          TableName: "EventParticipants",
          KeyConditionExpression: "eventId = :eventId",
          ExpressionAttributeValues: { ":eventId": eventId },
        }),
      ),
    ]);

    if (!eventDetails.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Event not found" }),
      };
    }

    const participants = participantsResult.Items || [];
    const userIds = participants.map((p) => p.userId).filter((id) => !!id);

    let userNamesMap: Record<string, string | null> = {};
    if (userIds.length > 0) {
      const batchResult = await client.send(
        new BatchGetCommand({
          RequestItems: {
            Users: {
              Keys: userIds.map((userId) => ({ userId })),
              ProjectionExpression: "#uid, #nm",
              ExpressionAttributeNames: {
                "#uid": "userId",
                "#nm": "name",
              },
            },
          },
        }),
      );
      const users = batchResult.Responses?.Users || [];
      users.forEach((user: any) => {
        userNamesMap[user.userId] = user.name || null;
      });
    }

    const participantDetails = participants.map((participant) => {
      return {
        ...participant,
        name: userNamesMap[participant.userId] ?? null,
      };
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        event: eventDetails.Item,
        participants: participantDetails,
      }),
    };
  } catch (error) {
    console.log("🚀 ~ getEventById ~ error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
}
