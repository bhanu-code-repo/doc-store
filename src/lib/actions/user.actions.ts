// src/lib/actions/user.actions.ts
"use server";

// Imports
import { ID, Query } from "node-appwrite";
import { createAdminClient, createSessionClient } from "../appwrite";
import { appwriteConfig } from "../appwrite/config";
import { parseStringify } from "../utils";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { avatarPlaceholderUrl } from "@/constants";

/**
 * Finds a user document in the Appwrite users collection by email address.
 * @param {string} email The email address to search for.
 * @returns {Promise<import("node-appwrite").Document | null>} The user document if found, or null otherwise.
 */
const getUserByEmail = async (email: string) => {
  const { databases } = await createAdminClient();

  const users = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.usersCollectionId,
    [Query.equal("email", email)]
  );

  return users.total > 0 ? users.documents[0] : null;
};

/**
 * Logs the given error and message to the console and then re-throws the error.
 * @param {unknown} error The error to log and re-throw.
 * @param {string} message The message to log.
 */
const handleError = (error: unknown, message: string) => {
  console.log(error, message);
  throw error;
};

/**
 * Sends an email OTP to the given email address.
 * @param {{ email: string }} param
 * @param {string} param.email The email address to send the OTP to.
 * @returns {Promise<string>} The ID of the session if the OTP is sent
 * successfully.
 */
export const sendEmailOTP = async ({ email }: { email: string }) => {
  const { account } = await createAdminClient();

  try {
    const session = await account.createEmailToken(ID.unique(), email);
    return session.userId;
  } catch (error) {
    handleError(error, "Error creating email token.");
  }
};

/**
 * Create a new user account.
 *
 * Sends an email OTP and creates a new user document in the Appwrite users collection.
 * If the user already exists, this function will only send an email OTP and not create a new document.
 *
 * @param {Object} data
 * @param {string} data.fullName
 * @param {string} data.email
 *
 * @returns {Promise<string>}
 */
export const createAccount = async ({
  fullName,
  email,
}: {
  fullName: string;
  email: string;
}) => {
  const existingUser = await getUserByEmail(email);

  const accountId = await sendEmailOTP({ email });
  if (!accountId) throw new Error("Failed to send email OTP.");

  if (!existingUser) {
    const { databases } = await createAdminClient();

    await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.usersCollectionId,
      ID.unique(),
      {
        fullName,
        email,
        avatar: avatarPlaceholderUrl,
        accountId,
      }
    );
  }

  return parseStringify({ accountId });
};

/**
 * Verify the given OTP for the given account ID and set the session if successful.
 * @param accountId The ID of the account to verify the OTP for.
 * @param otp The OTP to verify.
 * @returns The ID of the session if the OTP is valid, or an error if not.
 */
export const verifySecret = async ({
  accountId,
  otp,
}: {
  accountId: string;
  otp: string;
}) => {
  try {
    const { account } = await createAdminClient();

    const session = await account.createSession(accountId, otp);

    (await cookies()).set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: true,
    });

    return parseStringify({ sessionId: session.$id });
  } catch (error) {
    handleError(error, "Failed to verify OTP");
  }
};

/**
 * Returns the user document for the currently signed in user.
 *
 * If the user is not signed in or if the user document is not found, this function will return null.
 * @returns {Promise<import("node-appwrite").Document | null>} The user document if it exists, or null otherwise.
 */
export const getCurrentUser = async () => {
  try {
    const { databases, account } = await createSessionClient();

    const result = await account.get();

    const user = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.usersCollectionId,
      [Query.equal("accountId", result.$id)]
    );

    if (user.total <= 0) return null;

    return parseStringify(user.documents[0]);
  } catch (error) {
    console.log(error);
  }
};

/**
 * Signs out the currently signed in user.
 *
 * Deletes the current session and removes the Appwrite session cookie.
 * Redirects to the sign-in page after signing out.
 */
export const signOutUser = async () => {
  const { account } = await createSessionClient();

  try {
    await account.deleteSession("current");
    (await cookies()).delete("appwrite-session");
  } catch (error) {
    handleError(error, "Failed to sign out user");
  } finally {
    redirect("/sign-in");
  }
};

/**
 * Signs in a user using their email address.
 *
 * If the user with the given email exists, an OTP is sent to their email address.
 * If the user does not exist, an error is returned.
 *
 * @param {{ email: string }} param
 * @param {string} param.email The email address of the user trying to sign in.
 * @returns {Promise<{ accountId: string | null, error?: string }>} The account ID if the user is found, or an error message if not.
 */
export const signInUser = async ({ email }: { email: string }) => {
  try {
    const existingUser = await getUserByEmail(email);

    // User exists, send OTP
    if (existingUser) {
      await sendEmailOTP({ email });
      return parseStringify({ accountId: existingUser.accountId });
    }

    return parseStringify({ accountId: null, error: "User not found" });
  } catch (error) {
    handleError(error, "Failed to sign in user");
  }
};
