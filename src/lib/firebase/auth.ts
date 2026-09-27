import { getAuth } from "firebase/auth";
import { getFirebaseApp } from "@/lib/firebase/app";

export const auth = getAuth(getFirebaseApp());
