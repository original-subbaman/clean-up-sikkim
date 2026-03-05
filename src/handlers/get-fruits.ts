import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

export const getFruitsHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod !== "GET") {
    throw new Error(
      `getMethod only accept GET method, you tried: ${event.httpMethod}`,
    );
  }

  const response: APIGatewayProxyResult = {
    statusCode: 200,
    body: JSON.stringify(["apple", "banana", "grape"]),
  };

  // All log statements are written to CloudWatch
  console.info(
    `response from: ${event.path} statusCode: ${response.statusCode} body: ${response.body}`,
  );
  return response;
};
