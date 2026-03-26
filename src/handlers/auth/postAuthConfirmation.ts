import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { PostConfirmationTriggerEvent } from "aws-lambda";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE_NAME = process.env.USERS_TABLE;
if (!TABLE_NAME) throw new Error("USERS_TABLE environment variable is not set");

export async function postAuthConfirmation(
  event: PostConfirmationTriggerEvent,
): Promise<PostConfirmationTriggerEvent> {
  try {
    const {
      sub,
      email,
      name,
      "custom:city": city,
      "custom:state": state,
    } = event.request.userAttributes;

    await client.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          userId: sub,
          email,
          name,
          city: city ?? null,
          state: state ?? null,
          totalPoints: 0,
          cleanupCount: 0,
          pinsReported: 0,
          badgeTier: "BRONZE",
          leaderboardPartition: "ALL",
          createdAt: new Date().toISOString(),
          isDeleted: false,
        },
        ConditionExpression: "attribute_not_exists(userId)",
      }),
    );

    return event;
  } catch (error) {
    console.error("[PostConfirmation] Failed to create user record:", error);
    throw error;
  }
}
