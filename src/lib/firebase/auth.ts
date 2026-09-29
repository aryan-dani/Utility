import { getAuth } from "firebase/auth";
import { getFirebaseApp } from "@/lib/firebase/app";
import { consumeRedirectResult } from "@/lib/firebaseAuth";

export const auth = getAuth(getFirebaseApp());

// Start the OAuth redirect handshake during module load (Store / PWA), so
// getRedirectResult does not wait for React effects on /login.
if (typeof window !== "undefined") {
  void consumeRedirectResult(auth);
}
