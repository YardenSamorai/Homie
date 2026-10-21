// Each build on a fresh Mac makes Xcode create an "Apple Development: Created via API" certificate whose
// private key is gone when the runner is. They pile up until Apple refuses a new one, so clear them first.
// Personal certificates (made in Xcode on a Mac) and distribution certificates are left alone.
import { readFileSync } from "node:fs";
import { sign } from "node:crypto";

const [keyPath] = process.argv.slice(2);
const { ASC_KEY_ID: keyId, ASC_ISSUER_ID: issuer } = process.env;
const key = readFileSync(keyPath, "utf8");

const part = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const unsigned = `${part({ alg: "ES256", kid: keyId, typ: "JWT" })}.${part({ iss: issuer, iat: now, exp: now + 600, aud: "appstoreconnect-v1" })}`;
const jwt = `${unsigned}.${sign("sha256", Buffer.from(unsigned), { key, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
const api = (path, method = "GET") =>
  fetch(`https://api.appstoreconnect.apple.com${path}`, { method, headers: { authorization: `Bearer ${jwt}` } });

const list = await (await api("/v1/certificates?filter[certificateType]=DEVELOPMENT&limit=200")).json();
const stale = (list.data ?? []).filter((cert) => cert.attributes.name === "Apple Development: Created via API");
for (const cert of stale) {
  const res = await api(`/v1/certificates/${cert.id}`, "DELETE");
  console.log("revoked", cert.id, res.status);
}
console.log(`${stale.length} build certificates cleared`);
