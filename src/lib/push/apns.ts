import "server-only";
import { sign } from "node:crypto";
import http2 from "node:http2";

/**
 * Apple's push service, for the iPhone app. Token auth: the .p8 key from developer.apple.com → Keys
 * (with APNs) signs a short-lived JWT. APNs only speaks HTTP/2, which fetch can't, hence node:http2.
 */
type Keys = { keyId: string; teamId: string; privateKey: string; topic: string };

export type ApnsMessage = {
  title: string;
  body: string;
  url: string;
  collapseId: string;
  /** The red number on the app icon; left as it is when missing. */
  badge?: number;
};
export type ApnsResult = "sent" | "gone" | "failed";

const PRODUCTION = "api.push.apple.com";
const SANDBOX = "api.sandbox.push.apple.com";

/** APNS_KEY_ID + APNS_TEAM_ID + APNS_PRIVATE_KEY, or null: notifications stay off. */
export function apnsKeys(): Keys | null {
  const keyId = process.env.APNS_KEY_ID?.trim();
  const teamId = process.env.APNS_TEAM_ID?.trim();
  const privateKey = process.env.APNS_PRIVATE_KEY?.trim().replace(/\\n/g, "\n");
  if (!keyId || !teamId || !privateKey) return null;
  return { keyId, teamId, privateKey, topic: process.env.APNS_TOPIC?.trim() || "com.yardensamorai.homie" };
}

/** Apple wants one token reused for 20–60 minutes, not one per request. */
let cached: { keyId: string; token: string; at: number } | null = null;

function providerToken(keys: Keys) {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.keyId === keys.keyId && now - cached.at < 40 * 60) return cached.token;
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${part({ alg: "ES256", kid: keys.keyId })}.${part({ iss: keys.teamId, iat: now })}`;
  const signature = sign("sha256", Buffer.from(unsigned), { key: keys.privateKey, dsaEncoding: "ieee-p1363" });
  cached = { keyId: keys.keyId, token: `${unsigned}.${signature.toString("base64url")}`, at: now };
  return cached.token;
}

function post(host: string, deviceToken: string, keys: Keys, message: ApnsMessage) {
  return new Promise<{ status: number; reason: string }>((resolve) => {
    const client = http2.connect(`https://${host}`);
    const finish = (status: number, reason: string) => {
      client.close();
      resolve({ status, reason });
    };
    client.on("error", (error) => finish(0, error.message));
    const request = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${providerToken(keys)}`,
      "apns-topic": keys.topic,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-expiration": String(Math.floor(Date.now() / 1000) + 86400),
      "apns-collapse-id": message.collapseId.slice(0, 64),
      "content-type": "application/json",
    });
    let status = 0;
    let body = "";
    request.setEncoding("utf8");
    request.on("response", (headers) => {
      status = Number(headers[":status"]);
    });
    request.on("data", (chunk: string) => {
      body += chunk;
    });
    request.on("end", () => {
      let reason = "";
      try {
        reason = (JSON.parse(body) as { reason?: string }).reason ?? "";
      } catch {}
      finish(status, reason);
    });
    request.on("error", (error) => finish(0, error.message));
    request.setTimeout(10_000, () => request.close(http2.constants.NGHTTP2_CANCEL));
    request.end(
      JSON.stringify({
        aps: {
          alert: { title: message.title, body: message.body },
          sound: "default",
          "thread-id": "activity",
          ...(message.badge !== undefined ? { badge: message.badge } : {}),
        },
        url: message.url,
      }),
    );
  });
}

/** `gone`: the app was removed or notifications were turned off for good; forget the device. */
export async function sendApns(deviceToken: string, message: ApnsMessage, keys: Keys): Promise<ApnsResult> {
  let result = await post(PRODUCTION, deviceToken, keys, message);
  // An Xcode build registers with the sandbox; TestFlight and the App Store with production. Try the other before giving up.
  if (result.reason === "BadDeviceToken") {
    const other = await post(SANDBOX, deviceToken, keys, message);
    if (other.status === 200 || other.reason !== "BadDeviceToken") result = other;
  }
  if (result.status === 200) return "sent";
  console.error("[apns]", result.status, result.reason);
  if (result.status === 410 || ["BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic"].includes(result.reason)) return "gone";
  return "failed";
}
