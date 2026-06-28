import "dotenv/config";
import { runLoop } from "./jobs";

runLoop().catch((err) => {
  console.error("[transform] fatal:", err);
  process.exit(1);
});
