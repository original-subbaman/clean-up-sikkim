import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

const s3 = new S3Client({ region: process.env.AWS_REGION });

const BUCKET = process.env.DUMP_PINS_BUCKET;
const URL_EXPIRATION_SECONDS = 300; // URL valid for 5 minutes
const CONTENT_TYPE = "image/jpeg"; // Adjust as needed for different file types

export async function generateUploadUrlHandler(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const userId = event.requestContext.authorizer?.claims?.sub;
    const { fileType } = JSON.parse(event.body ?? "{}"); // e.g. "image/jpeg"

    if (!fileType || !userId || fileType !== CONTENT_TYPE) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid request" }),
      };
    }

    const key = `pins/${userId}/${crypto.randomUUID()}.jpg`;

    const url = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ContentType: fileType,
      }),
      { expiresIn: URL_EXPIRATION_SECONDS }, // 5 minutes
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        uploadUrl: url, // frontend PUTs to this
        photoUrl: `https://${BUCKET}.s3.amazonaws.com/${key}`, // save this in DynamoDB
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Failed to generate upload URL",
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
}
