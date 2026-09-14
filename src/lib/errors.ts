import { FirebaseError } from "firebase/app";

const FALLBACK = "Something went wrong. Try again.";

function codeOf(err: unknown): string | null {
  if (err instanceof FirebaseError) return err.code;
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code: unknown }).code;
    if (typeof code === "string") return code;
  }
  return null;
}

/** Map auth/Firestore/network errors to a short user-facing sentence. Never returns raw SDK text. */
export function describeError(err: unknown, fallback = FALLBACK): string {
  const code = codeOf(err);

  switch (code) {
    case "auth/invalid-email":
      return "The email address is not formatted correctly.";
    case "auth/user-disabled":
      return "This user account has been disabled.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password. Please try again.";
    case "auth/email-already-in-use":
      return "An account with this email address already exists.";
    case "auth/weak-password":
      return "The password is too weak. Please use at least 6 characters.";
    case "auth/popup-closed-by-user":
      return "Sign-in was cancelled. Please try again.";
    case "auth/popup-blocked":
    case "auth/operation-not-supported-in-this-environment":
      return "The sign-in popup was blocked. Continue in this tab when prompted.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a minute and try again.";
    case "auth/operation-not-allowed":
      return "This sign-up method is disabled. Try another option or email.";
    case "auth/account-exists-with-different-credential":
      return "This email is already used with Google. Sign in with Google, then you can link GitHub from your profile.";
    case "auth/credential-already-in-use":
      return "This GitHub login is already tied to another Utility account.";
    case "auth/network-request-failed":
      return "A network error occurred. Please check your internet connection.";
    case "permission-denied":
    case "firestore/permission-denied":
      return "You do not have permission to do that.";
    case "unavailable":
    case "firestore/unavailable":
      return "Service is temporarily unavailable. Try again shortly.";
    case "resource-exhausted":
    case "firestore/resource-exhausted":
      return "Quota exceeded. Try again later.";
    default:
      break;
  }

  if (err instanceof TypeError && /fetch|network|Failed to fetch/i.test(err.message)) {
    return "A network error occurred. Please check your internet connection.";
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Check your connection and try again.";
  }

  return fallback;
}

/** @deprecated Prefer describeError(err). Kept for login/signup code-string call sites. */
export function getFriendlyErrorMessage(errorCode: string): string {
  return describeError({ code: errorCode });
}
