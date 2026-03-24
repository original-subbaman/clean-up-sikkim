import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const baseClient = new DynamoDBClient({
  region: "ap-south-1",
});
const client = DynamoDBDocumentClient.from(baseClient);

export async function getUserEvents(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const eventsParticipantsTable = process.env.EVENT_PARTICIPANTS_TABLE;
    const userId = event.pathParameters?.userId;

    if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid userId path parameter" }),
      };
    }

    const userEventsResult = await client.send(
      new QueryCommand({
        TableName: eventsParticipantsTable,
        IndexName: "GSI-User-Events",
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
      }),
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        events: userEventsResult.Items || [],
      }),
    };
  } catch (error) {
    console.log("🚀 ~ getUserEvents ~ error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
}
