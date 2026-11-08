// Public half of the Chromium signing key. The private half lives only in the
// CRX_PRIVATE_KEY repository secret. Putting the public key into the manifest
// gives every Chromium install (signed .crx or unpacked folder) the same ID.
import { createHash } from "node:crypto";

export const PUBLIC_KEY =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmrdlNklNhtMBs/OfyR6bFIR2Qdo0uKFxvNfctsUFLChwNCWRNTupOIvFGZVLNFjoCAgpxayDSFmeJ7IYOgrBpw0rOnJbK6dO+er5nmkzNcbgp/H1FZfUeTavRgyrGypqVnGF9i+SbNNmeimcrhSlIiCxAf6QMLEy/Zyi6WiNrWuiplOOZ5rhKpT79j/uvobF2LEoJdecLaHb1Uw/rrGOzrmxTi/plKDMszPrhkNdN0pEC/FyC2GslcRavqvUr912MdKDHZtmN/YTEskJgyYwT8KTga1HucDgbPUSClXSZaHJleCfUN6JtxpQxMg5J0teCeYT9qcxfDvf7MPrzBvUcQIDAQAB";

// Chromium extension ID: first 32 hex digits of SHA-256(public key), written with a–p
export const ID = createHash("sha256")
  .update(Buffer.from(PUBLIC_KEY, "base64"))
  .digest("hex")
  .slice(0, 32)
  .replace(/[0-9a-f]/g, (c) => String.fromCharCode(97 + parseInt(c, 16)));
