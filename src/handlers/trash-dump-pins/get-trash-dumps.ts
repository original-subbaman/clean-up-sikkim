import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import ngeohash from "ngeohash";

const client = new DynamoDBClient({
  region: "ap-south-1",
});

export const getTrashDumpsHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const dumpPinsTable = process.env.DUMP_PINS_TABLE;
    const queryStrParams = event.queryStringParameters || {};
    const lat = queryStrParams?.lat ? parseFloat(queryStrParams.lat) : 27.3314;
    const lng = queryStrParams?.lng ? parseFloat(queryStrParams.lng) : 88.6138;

    if (isNaN(lat) || isNaN(lng)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid latitude or longitude" }),
      };
    }

    // Encode lat/lng to geohash
    const geohash = ngeohash.encode(lat, lng, 6);
    const neighbors = ngeohash.neighbors(geohash);
    const geohashes = [geohash, ...Object.values(neighbors)];

    const results = await Promise.all(
      geohashes.map((g) =>
        client.send(
          new QueryCommand({
            TableName: dumpPinsTable,
            IndexName: "GSI-Geohash",
            KeyConditionExpression: "geohash = :g",
            ExpressionAttributeValues: {
              ":g": { S: g },
            },
          }),
        ),
      ),
    );

    const allPins = results.flatMap((r) => r.Items ?? []);

    return {
      statusCode: 200,
      body: JSON.stringify(allPins.length > 0 ? allPins : ["No data found"]),
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
