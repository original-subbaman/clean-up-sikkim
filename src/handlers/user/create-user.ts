import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { z } from "zod";
import { PutItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({
  region: "ap-south-1",
});

export const createUserSchema = z.object({
  city: z.string(),
  state: z.string(),
  totalPoints: z.number(),
  leaderboardPartition: z.string(),
  cognitoUserId: z.string(),
  email: z.string().email(),
});

export const createUserHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const tableName = process.env.USERS_TABLE || "Users";
    const parsedBody =
      typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    const parseResult = createUserSchema.safeParse(parsedBody);

    if (!parseResult.success) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Invalid request body",
          errors: parseResult.error.issues,
        }),
      };
    }

    const result = parseResult.data;

    // Check for duplicate user by cognitoUserId
    const getUserCommand = new GetItemCommand({
      TableName: tableName,
      Key: {
        userId: { S: result.cognitoUserId },
      },
    });

    const getUserResponse = await client.send(getUserCommand);
    if (getUserResponse.Item) {
      return {
        statusCode: 409,
        body: JSON.stringify({ message: "User already exists" }),
      };
    }

    const command = new PutItemCommand({
      TableName: tableName,
      Item: {
        userId: { S: result.cognitoUserId },
        city: { S: result.city },
        state: { S: result.state },
        totalPoints: { N: result.totalPoints.toString() },
        leaderboardPartition: { S: result.leaderboardPartition },
        email: { S: result.email },
      },
    });

    await client.send(command);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "User created successfully" }),
    };
  } catch (error) {
    console.error("Error creating user:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
