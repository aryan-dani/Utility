import { getFirestore } from "firebase/firestore";
import { getFirebaseApp } from "@/lib/firebase/app";

export const db = getFirestore(getFirebaseApp());
