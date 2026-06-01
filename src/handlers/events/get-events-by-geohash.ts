import { apiResponse } from "../../utils/helper";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import ngeohash from "ngeohash";
import { EVENT_STATUS, RANGE_CONFIG, RangeOption } from "../../utils/constants";

const baseClient = new DynamoDBClient({
    region: "ap-south-1",
});
const client = DynamoDBDocumentClient.from(baseClient);

function distanceInKm(fromLat: number, fromLng: number, toLat: number, toLng: number) {
    const earthRadiusKm = 6371;
    const degreesToRadians = Math.PI / 180;
    const dLat = (toLat - fromLat) * degreesToRadians;
    const dLng = (toLng - fromLng) * degreesToRadians;
    const lat1 = fromLat * degreesToRadians;
    const lat2 = toLat * degreesToRadians;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function getEventsByGeohash(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
        const eventsTable = process.env.EVENTS_TABLE;
        const latStr = event.queryStringParameters?.lat;
        const lngStr = event.queryStringParameters?.lng;
        const lat = latStr ? parseFloat(latStr) : undefined;
        const lng = lngStr ? parseFloat(lngStr) : undefined;
        if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) {
            return apiResponse(400, {
                message: "lat and lng query parameters are required and must be valid numbers",
            });
        }
        const range = (event.queryStringParameters?.range ?? "5km") as RangeOption;
        if (!Object.keys(RANGE_CONFIG).includes(range)) {
            return apiResponse(400, {
                message: `Invalid range. Must be one of: ${Object.keys(RANGE_CONFIG).join(", ")}`,
            });
        }
        const { geohashLength, radiusKm, indexName, attribute } = RANGE_CONFIG[range];
        const geohash = ngeohash.encode(lat, lng, geohashLength);
        const result = await client.send(new QueryCommand({
            TableName: eventsTable,
            IndexName: indexName,
            KeyConditionExpression: "#geohash = :geohash AND scheduledAt >= :currentTime",
            FilterExpression: "#status IN (:activeStatus, :upcomingStatus)",
            ExpressionAttributeNames: {
                "#geohash": attribute,
                "#status": "status",
            },
            ExpressionAttributeValues: {
                ":geohash": geohash,
                ":currentTime": new Date().toISOString(),
                ":activeStatus": EVENT_STATUS.ACTIVE,
                ":upcomingStatus": EVENT_STATUS.UP_COMING,
            },
        }));
        const nearbyEvents = (result.Items ?? []).filter((item) => {
            const eventLat = Number(item.lat);
            const eventLng = Number(item.lng);
            return (
                !Number.isNaN(eventLat) &&
                !Number.isNaN(eventLng) &&
                distanceInKm(lat, lng, eventLat, eventLng) <= radiusKm
            );
        });
        return apiResponse(200, { events: nearbyEvents });
    }
    catch (error) {
        console.log("🚀 ~ getEventsByGeohash ~ error:", error);
        return apiResponse(500, {
            message: "Internal server error",
            error: (error as Error).message,
        });
    }
}

