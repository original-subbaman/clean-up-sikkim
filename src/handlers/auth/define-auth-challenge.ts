import { DefineAuthChallengeTriggerEvent } from "aws-lambda";

export async function defineAuthChallenge(
  event: DefineAuthChallengeTriggerEvent,
) {
  const session = event.request.session;

  if (session.length === 0) {
    event.response.issueTokens = false;
    event.response.failAuthentication = false;
    event.response.challengeName = "CUSTOM_CHALLENGE";
  } else if (
    session.length <= 6 &&
    session.at(-1)?.challengeName === "CUSTOM_CHALLENGE" &&
    session.at(-1)?.challengeResult === false
  ) {
    event.response.issueTokens = false;
    event.response.failAuthentication = false;
    event.response.challengeName = "CUSTOM_CHALLENGE";
  } else if (session.at(-1)?.challengeResult === true) {
    event.response.issueTokens = true;
    event.response.failAuthentication = false;
  } else {
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
  }

  return event;
}
