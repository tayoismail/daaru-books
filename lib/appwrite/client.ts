import { Client, Account, Databases, Storage } from "appwrite";
import { env } from "@/lib/env";

export const client = new Client()
  .setEndpoint(env.appwriteEndpoint)
  .setProject(env.appwriteProjectId);

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
