import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, GithubAuthProvider } from "firebase/auth"; // Connexion git et google
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyC5HVOdNqsvzj3-Mv9kFZE5G_Yu8ihNRis",
  authDomain: "tp2-app-web.firebaseapp.com",
  projectId: "tp2-app-web",
  storageBucket: "tp2-app-web.firebasestorage.app",
  messagingSenderId: "227943001122",
  appId: "1:227943001122:web:459311c16c557e431c2e7b"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
