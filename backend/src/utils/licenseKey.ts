import { randomBytes } from "crypto";

// Demonstration keys only: these cannot activate a real game.
export const generateMockLicenseKey = () =>
  `DEMO-${randomBytes(8).toString("hex").toUpperCase().match(/.{4}/g)!.join("-")}`;
