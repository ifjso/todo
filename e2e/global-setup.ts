import mongoose from "mongoose";
import { E2E_MONGODB_URI } from "../playwright.config";

/** E2E 전용 DB 를 비우고 시작한다. */
export default async function globalSetup() {
  const conn = await mongoose.createConnection(E2E_MONGODB_URI).asPromise();
  await conn.dropDatabase();
  await conn.close();
}
