// Public half of the Chromium signing key. The private half lives only in the
// CRX_PRIVATE_KEY repository secret. Putting the public key into the manifest
// gives every Chromium install (signed .crx or unpacked folder) the same ID.
import { createHash } from "node:crypto";

export const PUBLIC_KEY =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtTkwbt0YH1GhB3YnWBY3qvg1otuL4TvSjv2YsrARWzCqJEmMBX+U8toL6EFNVMNQ" +
  "NrFmPin5OhzjmO6YeaK9+dd/C9svFbn7MQGp8lg4eV+5XnArZVaiklduvkCZsyNWY0apWrPhZsjSfKKjNmS7jhaSzJoV00olPXSCL1WjRvyR" +
  "y2u+HDx55PfO20UnkDzBqkVypRBoYxYtv5rArBRs0cvGcmPVJIcv/U5YYjFIjtNQ3I1I2m65BWVXiwvUP+WF3FTb71IQrzVYqE0MG+YvkDM4" +
  "bh6rCiZt4VB+wBLlR9hb1j+B2oGdTbzkOTwlqDs5canFV+lTEP2NCJqrc+LtqQIDAQAB";

// Chromium extension ID: first 32 hex digits of SHA-256(public key), written with a–p
export const ID = createHash("sha256")
  .update(Buffer.from(PUBLIC_KEY, "base64"))
  .digest("hex")
  .slice(0, 32)
  .replace(/[0-9a-f]/g, (c) => String.fromCharCode(97 + parseInt(c, 16)));
