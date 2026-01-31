import { config } from "../shared/config.js";
import { createApp } from "./app.js";

const start = () => {
  if (!config.apiKey) {
    console.error("Missing API_KEY in environment");
    process.exit(1);
  }

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`API listening on http://localhost:${config.port}`);
  });
};

start();
