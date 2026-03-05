import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const isLocal = !!process.env.DYNAMODB_ENDPOINT;
console.log("🚀 ~ isLocal:", process.env.DYNAMODB_ENDPOINT);

const client = new DynamoDBClient({
  region: "ap-south-1",
  endpoint: process.env.DYNAMODB_ENDPOINT,
  credentials: isLocal
    ? {
        accessKeyId: "local",
        secretAccessKey: "local",
      }
    : undefined,
});

const docClient = DynamoDBDocumentClient.from(client);

export const getTrashDumpsHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    console.log("MAIN_TABLE:", process.env.MAIN_TABLE);
    console.log("DYNAMODB_ENDPOINT:", process.env.DYNAMODB_ENDPOINT);
    const command = new ScanCommand({
      TableName: process.env.MAIN_TABLE,
    });

    const data = await docClient.send(command);

    return {
      statusCode: 200,
      body: JSON.stringify(data.Items ?? ["No data found"]),
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
