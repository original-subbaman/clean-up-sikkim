// postConfirmation.test.ts
import { postAuthConfirmation } from "../../../src/handlers/auth/postAuthConfirmation";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock"; // npm install aws-sdk-client-mock

const ddbMock = mockClient(DynamoDBDocumentClient);

beforeEach(() => {
  ddbMock.reset();
  process.env.USERS_TABLE = "test-Users";
});

const mockEvent = {
  request: {
    userAttributes: {
      sub: "user-123",
      email: "test@example.com",
      name: "Rahul Sharma",
      "custom:city": "Gangtok",
      "custom:state": "Sikkim",
    },
  },
} as any;

it("creates a user record in DynamoDB", async () => {
  ddbMock.on(PutCommand).resolves({});

  const result = await postAuthConfirmation(mockEvent);

  // function must return the event back to Cognito
  expect(result).toBe(mockEvent);

  // assert DynamoDB was called with correct values
  const calls = ddbMock.commandCalls(PutCommand);
  expect(calls).toHaveLength(1);
  expect(calls[0].args[0].input.Item).toMatchObject({
    userId: "user-123",
    email: "test@example.com",
    name: "Rahul Sharma",
    city: "Gangtok",
    state: "Sikkim",
    totalPoints: 0,
    badgeTier: "BRONZE",
  });
});

it("throws if DynamoDB write fails", async () => {
  ddbMock.on(PutCommand).rejects(new Error("DynamoDB unavailable"));

  await expect(postAuthConfirmation(mockEvent)).rejects.toThrow(
    "DynamoDB unavailable",
  );
});

it("throws if USERS_TABLE env var is missing", async () => {
  delete process.env.USERS_TABLE;

  await expect(postAuthConfirmation(mockEvent)).rejects.toThrow(
    "USERS_TABLE environment variable is not set",
  );
});
