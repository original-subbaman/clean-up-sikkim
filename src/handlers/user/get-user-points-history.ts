import { apiResponse } from "../../utils/helper";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
const baseClient = new DynamoDBClient({
    region: "ap-south-1",
});
const client = DynamoDBDocumentClient.from(baseClient);
export async function getUserPointsHistory(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
        const tableName = process.env.POINT_TRANSACTIONS_TABLE;
        const userId = event.pathParameters?.userId;
        if (!userId) {
            return apiResponse(400, { message: "Missing userId parameter" });
        }
        const pointHistory = await client.send(new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: "userId = :userId",
            ExpressionAttributeValues: {
                ":userId": userId,
            },
        }));
        return apiResponse(200, {
            data: pointHistory.Items || [],
        });
    }
    catch (error) {
        console.log("🚀 ~ getUserPointsHistory ~ error:", error);
        return apiResponse(500, { message: "Internal Server Error" });
    }
}

