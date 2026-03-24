import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import ngeohash from "ngeohash";
import { EVENT_STATUS, RANGE_CONFIG, RangeOption } from "../../utils/constants";

const baseClient = new DynamoDBClient({
  region: "ap-south-1",
});
const client = DynamoDBDocumentClient.from(baseClient);

export async function getEventsByGeohash(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const eventsTable = process.env.EVENTS_TABLE;
    const latStr = event.queryStringParameters?.lat;
    const lngStr = event.queryStringParameters?.lng;

    const lat = latStr ? parseFloat(latStr) : undefined;
    const lng = lngStr ? parseFloat(lngStr) : undefined;

    if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message:
            "lat and lng query parameters are required and must be valid numbers",
        }),
      };
    }

    const range = (event.queryStringParameters?.range ?? "5km") as RangeOption;

    if (!Object.keys(RANGE_CONFIG).includes(range)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: `Invalid range. Must be one of: ${Object.keys(RANGE_CONFIG).join(", ")}`,
        }),
      };
    }

    const { geohashLength, indexName, attribute } = RANGE_CONFIG[range];
    const geohash = ngeohash.encode(lat, lng, geohashLength);
    const neighbors = ngeohash.neighbors(geohash);
    const geohashesToQuery = [geohash, ...neighbors];

    const events = await Promise.all(
      geohashesToQuery.map(async (g) => {
        const result = await client.send(
          new QueryCommand({
            TableName: eventsTable,
            IndexName: indexName,
            KeyConditionExpression: `${attribute} = :geohash AND scheduledAt >= :currentTime`,
            FilterExpression: "#status IN (:activeStatus, :upcomingStatus)",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: {
              ":geohash": g,
              ":currentTime": new Date().toISOString(),
              ":activeStatus": EVENT_STATUS.ACTIVE,
              ":upcomingStatus": EVENT_STATUS.UP_COMING,
            },
          }),
        );
        return Array.isArray(result.Items) ? result.Items : [];
      }),
    );

    const allEvents = events.flat();
    const deduplicated = Array.from(
      new Map(allEvents.map((e) => [e.eventId, e])).values(),
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ events: deduplicated }),
    };
  } catch (error) {
    console.log("🚀 ~ getEventsByGeohash ~ error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal server error",
        error: (error as Error).message,
      }),
    };
  }
}
