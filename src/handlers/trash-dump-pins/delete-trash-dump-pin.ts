import { apiResponse } from "../../utils/helper";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { z } from "zod";
const client = new DynamoDBClient({
    region: "ap-south-1",
});
const deletePinSchema = z.object({
    pinId: z.string(),
});
// TODO: Add authentication and associate reportedBy with user info from auth token instead of accepting it in request body. This will prevent impersonation and ensure data integrity.
export const deleteTrashDumpPinHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    let body;
    const dumpPinsTable = process.env.DUMP_PINS_TABLE;
    try {
        body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
        const parseResult = deletePinSchema.safeParse(body);
        if (!parseResult.success) {
            return apiResponse(400, {
                message: "Invalid request body",
                errors: parseResult.error.issues,
            });
        }
        const deletedPin = await client.send(new DeleteCommand({
            TableName: dumpPinsTable,
            Key: {
                pinId: parseResult.data.pinId,
            },
            ReturnValues: "ALL_OLD",
        }));
        if (!deletedPin || !deletedPin.Attributes) {
            return apiResponse(404, {
                message: "Pin not found",
            });
        }
        return apiResponse(200, {
            message: "Trash dump pin deleted successfully",
        });
    }
    catch (error) {
        console.log("🚀 ~ deleteTrashDumpPinHandler ~ error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        return apiResponse(500, { message });
    }
};

