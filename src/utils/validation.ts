import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

export async function isValidEventId(
  client: DynamoDBDocumentClient,
  eventId: string,
): Promise<boolean> {
  const params = {
    TableName: "Events", // Update with your actual events table name
    Key: { eventId },
  };
  const result = await client.send(new GetCommand(params));
  return !!result.Item;
}

export async function isValidUserId(
  client: DynamoDBDocumentClient,
  userId: string,
): Promise<boolean> {
  const params = {
    TableName: "Users", // Update with your actual users table name
    Key: { userId },
  };
  const result = await client.send(new GetCommand(params));
  return !!result.Item;
}
