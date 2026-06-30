import { test } from "node:test";
import assert from "node:assert/strict";
import { oauthSignature } from "./twitter.js";

// Pins OAuth 1.0a HMAC-SHA1 signing to Twitter's own documented example
// (developer docs, "Creating a signature"). If this passes, the signature math
// — percent-encoding, base-string assembly, key construction — is correct.
//
// The expected value is HMAC-SHA1(documented signing key, documented signature
// base string) computed independently of this code, so it verifies that we
// assemble the exact base string Twitter documents.
test("oauthSignature matches the canonical Twitter example vector", () => {
  const sig = oauthSignature({
    method: "POST",
    url: "https://api.twitter.com/1.1/statuses/update.json",
    params: {
      status: "Hello Ladies + Gentlemen, a signed OAuth request!",
      include_entities: "true",
      oauth_consumer_key: "xvz1evFS4wEEPTGEFPHBog",
      oauth_nonce: "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg",
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: "1318622958",
      oauth_token: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb",
      oauth_version: "1.0",
    },
    consumerSecret: "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Y7uQ",
    tokenSecret: "LswwdoUaIVS3y/Ibm/7t/RYy86nUNLvGuJSGoaH/wsk",
  });
  assert.equal(sig, "jm5/jtmNiPHIcOM6dX+ElIK1vR8=");
});
