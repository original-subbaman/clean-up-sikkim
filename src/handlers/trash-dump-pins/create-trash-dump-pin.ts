import { apiResponse } from "../../utils/helper";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import ngeohash from "ngeohash";
import { v4 as uuidv4 } from "uuid";
import { dumpPinSchema } from "../../models/dumpPinSchema";
import { PIN_STATUS } from "../../utils/constants";
const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: "ap-south-1",
  }),
);

export const createTrashDumpPinHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  let body;
  const dumpPinsTable = process.env.DUMP_PINS_TABLE;
  const userTable = process.env.USERS_TABLE;
  try {
    if (!dumpPinsTable || !userTable) {
      throw new Error("Required DynamoDB table environment variables are not set");
    }

    body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    const parseResult = dumpPinSchema.safeParse(body);
    if (!parseResult.success) {
      return apiResponse(400, {
        message: "Invalid request body",
        errors: parseResult.error.issues,
      });
    }
    const userId = event.requestContext.authorizer?.claims?.sub;
    if (!userId) {
      return apiResponse(401, { message: "Unauthorized" });
    }

    const user = await client.send(
      new GetCommand({
        TableName: userTable,
        Key: {
          userId,
        },
      }),
    );
    if (!user.Item) {
      return apiResponse(404, { message: "User profile not found" });
    }
    if (!user.Item.name) {
      return apiResponse(400, { message: "User profile name is not set" });
    }

    const geohash = ngeohash.encode(
      parseResult.data.lat,
      parseResult.data.lng,
      6,
    );
    // Check for duplicate pin within 7 days
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const queryResult = await client.send(
      new QueryCommand({
        TableName: dumpPinsTable,
        IndexName: "GSI-Geohash",
        KeyConditionExpression:
          "geohash = :geohash AND createdAt >= :sevenDaysAgo",
        ExpressionAttributeValues: {
          ":geohash": geohash,
          ":sevenDaysAgo": sevenDaysAgo,
        },
      }),
    );
    const duplicate = queryResult.Items?.find(
      (item) =>
        item.lat === parseResult.data.lat && item.lng === parseResult.data.lng,
    );
    if (duplicate) {
      return apiResponse(409, {
        message:
          "A pin with the same lat/lng was created within the last 7 days.",
      });
    }
    const pinId = `pin-${uuidv4()}`;
    const newPin = {
      ...parseResult.data,
      pinId: pinId,
      createdAt: new Date().toISOString(),
      geohash: geohash,
      geohash5: geohash.substring(0, 5),
      geohash4: geohash.substring(0, 4),
      status: PIN_STATUS.OPEN,
      reportedBy: userId,
      reporterName: user.Item.name,
    };
    await client.send(
      new PutCommand({
        TableName: dumpPinsTable,
        Item: newPin,
      }),
    );
    return apiResponse(201, {
      message: "Dump pin created successfully",
      pinId: pinId,
    });
  } catch (error) {
    console.log("🚀 ~ createTrashDumpPinHandler ~ error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return apiResponse(500, { message });
  }
};
