import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import ngeohash from "ngeohash";
import { v4 as uuidv4 } from "uuid";
import { dumpPinSchema } from "../../models/dumpPinSchema";
import { PIN_STATUS } from "../../utils/constants";

const client = new DynamoDBClient({
  region: "ap-south-1",
});

// TODO: Add authentication and associate reportedBy with user info from auth token instead of accepting it in request body. This will prevent impersonation and ensure data integrity.
export const createTrashDumpPinHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  let body;
  const dumpPinsTable = process.env.DUMP_PINS_TABLE;
  try {
    body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    const parseResult = dumpPinSchema.safeParse(body);

    if (!parseResult.success) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Invalid request body",
          errors: parseResult.error.issues,
        }),
      };
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
      return {
        statusCode: 409,
        body: JSON.stringify({
          message:
            "A pin with the same lat/lng was created within the last 7 days.",
        }),
      };
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
    };

    await client.send(
      new PutCommand({
        TableName: dumpPinsTable,
        Item: newPin,
      }),
    );

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: "Dump pin created successfully",
        pinId: pinId,
      }),
    };
  } catch (error) {
    console.log("🚀 ~ createTrashDumpPinHandler ~ error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      statusCode: 500,
      body: JSON.stringify({ message }),
    };
  }
};
