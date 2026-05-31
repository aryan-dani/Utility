import { cookies } from "next/headers";
import { adminAuth } from "./firebaseAdmin";

export async function createClient() {
  const cookieStore = await cookies();
  const token = cookieStore.get("__session")?.value;

  return {
    auth: {
      async getUser() {
        if (!token) return { data: { user: null }, error: null };
        try {
          const decoded = await adminAuth().verifyIdToken(token);
          return {
            data: {
              user: {
                id: decoded.uid,
                uid: decoded.uid,
                email: decoded.email,
                email_verified: decoded.email_verified,
                name: decoded.name,
                picture: decoded.picture,
              },
            },
            error: null,
          };
        } catch (e) {
          console.warn("Firebase Admin verifyIdToken error in supabaseServer:", e);
          return { data: { user: null }, error: e };
        }
      },
    },
  };
}
