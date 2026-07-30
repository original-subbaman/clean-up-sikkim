import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  apiResponse,
  derivePinStatus,
  parseAndValidateEventBody,
} from "../../utils/helper";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { dumpPinReactionSchema } from "../../models/dumpPinReactionSchema";
import { PIN_STATUS, PIN_REACTION } from "../../utils/constants";

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.AWS_REGION ?? "ap-south-1",
  }),
);

const MAX_TRANSACTION_ATTEMPTS = 3;

function readPositiveInteger(name: string): number {
  const value = Number(process.env[name]);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be configured as a positive integer`);
  }

  return value;
}

export async function reactToTrashDumpPinHandler(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const dumpPinsTable = process.env.DUMP_PINS_TABLE;
  const reactionsTable = process.env.DUMP_PINS_REACTION_TABLE;

  try {
    const pinId = event.pathParameters?.pinId;
    const userId = event.requestContext.authorizer?.claims?.sub;

    if (!userId) {
      return apiResponse(401, { message: "Unauthorized" });
    }

    if (!pinId) {
      return apiResponse(400, { message: "pinId is required" });
    }

    const parsed = parseAndValidateEventBody(event, dumpPinReactionSchema);

    if (!parsed.success) {
      return apiResponse(400, {
        message: "Invalid reaction",
        errors: parsed.error.issues,
      });
    }

    if (!dumpPinsTable || !reactionsTable) {
      throw new Error("Required DynamoDB table configuration is missing");
    }

    const verificationThreshold = readPositiveInteger(
      "PIN_VERIFICATION_THRESHOLD",
    );
    const rejectionThreshold = readPositiveInteger("PIN_REJECTION_THRESHOLD");

    for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt++) {
      const pinResult = await client.send(
        new GetCommand({
          TableName: dumpPinsTable,
          Key: { pinId },
          ConsistentRead: true,
        }),
      );

      const pin = pinResult.Item;

      if (!pin) {
        return apiResponse(404, { message: "Pin not found" });
      }

      const reactionAllowedStatuses = [
        PIN_STATUS.REPORTED,
        PIN_STATUS.VERIFIED,
      ];

      if (!reactionAllowedStatuses.includes(pin.status)) {
        return apiResponse(409, {
          message: `Reactions are not accepted for ${pin.status} pins`,
        });
      }

      const currentUpvotes = pin.upvoteCount ?? 0;
      const currentFlags = pin.flagCount ?? 0;
      const currentVersion = pin.statusVersion ?? 0;
      const hasStoredVersion = pin.statusVersion !== undefined;

      const nextUpvotes =
        parsed.data.type === PIN_REACTION.UPVOTE
          ? currentUpvotes + 1
          : currentUpvotes;

      const nextFlags =
        parsed.data.type === PIN_REACTION.FLAG
          ? currentFlags + 1
          : currentFlags;

      const nextStatus = derivePinStatus({
        currentStatus: pin.status,
        upvoteCount: nextUpvotes,
        flagCount: nextFlags,
        verificationThreshold,
        rejectionThreshold,
      });

      const now = new Date().toISOString();
      const versionCondition = hasStoredVersion
        ? "statusVersion = :currentVersion"
        : "attribute_not_exists(statusVersion)";

      try {
        await client.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName: reactionsTable,
                  Item: {
                    pinId,
                    userId,
                    type: parsed.data.type,
                    createdAt: now,
                  },
                  ConditionExpression:
                    "attribute_not_exists(pinId) AND attribute_not_exists(userId)",
                },
              },
              {
                Update: {
                  TableName: dumpPinsTable,
                  Key: { pinId },
                  UpdateExpression: `
                    SET upvoteCount = :upvotes,
                        flagCount = :flags,
                        #status = :nextStatus,
                        statusVersion = :nextVersion,
                        statusUpdatedAt = :now
                  `,
                  ConditionExpression: `
                    attribute_exists(pinId)
                    AND ${versionCondition}
                    AND #status = :currentStatus
                  `,
                  ExpressionAttributeNames: {
                    "#status": "status",
                  },
                  ExpressionAttributeValues: {
                    ":upvotes": nextUpvotes,
                    ":flags": nextFlags,
                    ":nextStatus": nextStatus,
                    ":currentStatus": pin.status,
                    ...(hasStoredVersion
                      ? { ":currentVersion": currentVersion }
                      : {}),
                    ":nextVersion": currentVersion + 1,
                    ":now": now,
                  },
                },
              },
            ],
          }),
        );

        return apiResponse(200, {
          message: "Reaction recorded successfully",
          pinId,
          reaction: parsed.data.type,
          upvoteCount: nextUpvotes,
          flagCount: nextFlags,
          status: nextStatus,
        });
      } catch (error) {
        if (
          !(error instanceof Error) ||
          error.name !== "TransactionCanceledException"
        ) {
          throw error;
        }

        const existingReaction = await client.send(
          new GetCommand({
            TableName: reactionsTable,
            Key: { pinId, userId },
            ConsistentRead: true,
          }),
        );

        if (existingReaction.Item) {
          return apiResponse(409, {
            message: "You have already reacted to this pin",
          });
        }

        if (attempt === MAX_TRANSACTION_ATTEMPTS - 1) {
          throw error;
        }
      }
    }

    throw new Error("Unable to record reaction after retrying");
  } catch (error) {
    console.error("Unable to record trash dump pin reaction", error);
    return apiResponse(500, { message: "Unable to record reaction" });
  }
}
