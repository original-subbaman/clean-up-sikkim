import { apiResponse } from "../../utils/helper";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { eventRegistrationSchema } from "../../models/eventRegistrationSchema";
import { USER_EVENT_STATUS } from "../../utils/constants";
import { parseAndValidateEventBody } from "../../utils/helper";
import { isValidEventId, isValidUserId } from "../../utils/validation";
const baseClient = new DynamoDBClient({
    region: "ap-south-1",
});
const client = DynamoDBDocumentClient.from(baseClient);
export async function signUpToEvent(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
        const eventsParticipantsTable = process.env.EVENT_PARTICIPANTS_TABLE;
        const parseResult = parseAndValidateEventBody(event, eventRegistrationSchema);
        if (!parseResult.success) {
            return apiResponse(400, {
                message: "Invalid request body",
                errors: parseResult.error.issues,
            });
        }
        const { eventId, userId } = parseResult.data;
        // Validate eventId
        const eventValid = await isValidEventId(client, eventId);
        if (!eventValid) {
            return apiResponse(404, { message: "Event not found" });
        }
        // Validate userId
        const userValid = await isValidUserId(client, userId);
        if (!userValid) {
            return apiResponse(404, { message: "User not found" });
        }
        // Validate if user is already registered for the event
        const existingRegistration = await client.send(new GetCommand({
            TableName: eventsParticipantsTable,
            Key: { eventId, userId },
        }));
        if (existingRegistration.Item) {
            return apiResponse(409, {
                message: "User already registered for the event",
            });
        }
        await client.send(new PutCommand({
            TableName: eventsParticipantsTable,
            Item: {
                ...parseResult.data,
                status: USER_EVENT_STATUS.REGISTERED,
                registeredAt: new Date().toISOString(),
                attendedAt: null,
                pointsEarned: 0,
            },
        }));
        return apiResponse(200, {
            message: "Event registration successful",
        });
    }
    catch (error) {
        console.log("🚀 ~ signUpToEvent ~ error:", error);
        return apiResponse(500, {
            message: "Internal server error",
            error: (error as Error).message,
        });
    }
}

