import "dotenv/config";
import { runLoop } from "./jobs";

runLoop().catch((err) => {
  console.error("[export] fatal:", err);
  process.exit(1);
});
