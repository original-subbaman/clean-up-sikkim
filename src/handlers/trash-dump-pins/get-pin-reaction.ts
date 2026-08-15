import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { apiResponse } from "../../utils/helper";

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.AWS_REGION ?? "ap-south-1",
  }),
);

export async function getPinReactionHandler(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const reactionsTable = process.env.DUMP_PINS_REACTION_TABLE;
  try {
    const userId = event.requestContext.authorizer?.claims?.sub;
    const pinId = event.pathParameters?.pinId;

    const reaction = await client.send(
      new GetCommand({
        TableName: reactionsTable,
        Key: {
          userId,
          pinId,
        },
      }),
    );

    if (!reaction.Item) {
      return apiResponse(404, {
        isReacted: false,
        reaction: null,
      });
    }

    return apiResponse(200, { isReacted: true, reaction: reaction.Item.type });
  } catch (error) {
    console.log("🚀 ~ getPinReactionHandler ~ error:", error);
    return apiResponse(500, { message: "Internal server error" });
  }
}
