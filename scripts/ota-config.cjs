const fs = require("node:fs");
const path = require("node:path");
const { X509Certificate } = require("node:crypto");

module.exports = function otaConfig() {
  const certificate = "./modules/learning-updates/ota-certificate.pem";
  const certificateFile = path.resolve(__dirname, "..", certificate);
  if (!fs.existsSync(certificateFile)) throw Error("OTA requires a signing certificate; never disable verification.");
  const cert = new X509Certificate(fs.readFileSync(certificateFile));
  if (!cert.keyUsage?.includes("1.3.6.1.5.5.7.3.3")) throw Error("OTA certificate must include the codeSigning extended key usage.");
  return {
    runtimeVersion: { policy: "fingerprint" },
    updates: {
      enabled: true, url: "http://localhost:35197/manifest", checkAutomatically: "NEVER",
      fallbackToCacheTimeout: 0, useEmbeddedUpdate: true,
      requestHeaders: { "x-dtm-local-adapter": "1" },
      codeSigningCertificate: certificate,
      codeSigningMetadata: { keyid: "main", alg: "rsa-v1_5-sha256" },
    },
  };
};
