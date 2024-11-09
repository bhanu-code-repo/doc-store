// src/lib/appwrite/index.ts
import { Account, Client, Databases } from "node-appwrite";
import { appwriteConfig } from "./config";
import { cookies } from "next/headers";

/**
 * Asynchronously creates a session-based Appwrite client.
 *
 * This function is responsible for initializing a new Appwrite client
 * using endpoint URL and project ID from the configuration. It attempts
 * to retrieve the Appwrite session from the cookies. If a session is found,
 * it sets the session for the client. If no session is found, an error
 * is thrown. The function returns an object with `account` and `databases`
 * getters, which provide access to the Appwrite Account and Databases services.
 *
 * @throws {Error} If no session is found in the cookies.
 * @returns An object with `account` and `databases` getters for Appwrite services.
 */
export const createSessionClient = async () => {
  // Create a new Appwrite client instance
  const client = new Client()
    // Set the endpoint URL for the Appwrite client using the configuration
    .setEndpoint(appwriteConfig.endpointUrl)
    // Set the project ID for the Appwrite client using the configuration
    .setProject(appwriteConfig.projectId);

  // Attempt to retrieve the Appwrite session from cookies
  const session = (await cookies()).get("appwrite-session");

  // Check if the session is not found or has no value
  if (!session || !session.value)
    // Throw an error if no session is found
    throw new Error("No session found");

  // Set the session for the client using the retrieved session value
  client.setSession(session.value);

  // Return an object with `account` and `databases` getters
  return {
    // Getter for the Appwrite Account service
    get account() {
      return new Account(client);
    },
    // Getter for the Appwrite Databases service
    get databases() {
      return new Databases(client);
    },
  };
};

export const createAdminClient = async () => {};
