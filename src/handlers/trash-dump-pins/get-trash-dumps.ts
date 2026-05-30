import { apiResponse } from "../../utils/helper";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import ngeohash from "ngeohash";

const baseClient = new DynamoDBClient({
  region: "ap-south-1",
});
const client = DynamoDBDocumentClient.from(baseClient);

export const getTrashDumpsHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const dumpPinsTable = process.env.DUMP_PINS_TABLE;
    const queryStrParams = event.queryStringParameters || {};
    const lat = queryStrParams?.lat ? parseFloat(queryStrParams.lat) : 27.3314;
    const lng = queryStrParams?.lng ? parseFloat(queryStrParams.lng) : 88.6138;
    if (isNaN(lat) || isNaN(lng)) {
      return apiResponse(400, { message: "Invalid latitude or longitude" });
    }
    // Encode lat/lng to geohash
    const geohash = ngeohash.encode(lat, lng, 4);
    const neighbors = ngeohash.neighbors(geohash);
    const geohashes = [geohash, ...Object.values(neighbors)];
    const results = await Promise.all(
      geohashes.map((g) =>
        client.send(
          new QueryCommand({
            TableName: dumpPinsTable,
            IndexName: "GSI-Geohash4",
            KeyConditionExpression: "geohash4 = :g",
            ExpressionAttributeValues: {
              ":g": g,
            },
          }),
        ),
      ),
    );
    const allPins = results.flatMap((r) => r.Items ?? []);
    return apiResponse(
      200,
      allPins.length > 0 ? allPins : { message: "No data found" },
    );
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return apiResponse(500, { message });
  }
};
