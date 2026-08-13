import { connectDB } from "../src/config/db.js";

let connected = false;

export default async function handler(req, res) {
  if (!connected) {
    await connectDB();
    connected = true;
  }
  const { default: app } = await import("../src/app.js");
  return app(req, res);
}
