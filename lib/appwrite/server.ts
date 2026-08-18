import "server-only";
import { Client, Databases, Storage } from "appwrite";
import { env } from "@/lib/env";

const client = new Client()
  .setEndpoint(env.appwriteEndpoint)
  .setProject(env.appwriteProjectId)
  .setDevKey(env.appwriteApiKey);

export const adminDatabases = new Databases(client);
export const adminStorage = new Storage(client);

export { client as adminClient };
