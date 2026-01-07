import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAEew-jdWxIso7bNjZHNXYlznvXsp-f38s",
  authDomain: "igreja-a-mesa.firebaseapp.com",
  projectId: "igreja-a-mesa",
  storageBucket: "igreja-a-mesa.firebasestorage.app",
  messagingSenderId: "537505382060",
  appId: "1:537505382060:web:66eb60a4e91a9332e72909"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
