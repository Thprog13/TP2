import React, { useState } from "react";
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { useNavigate } from "react-router-dom";

import maisonneuve from "./assets/maisonneuve.jpg";
import googleLogo from "./assets/Google.PNG";

import { auth, db } from "./firebase";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

/* ---------- Providers ---------- */
const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();

/* ---------- reCAPTCHA ---------- */
const RECAPTCHA_SITE_KEY = "6LezIi4sAAAAAMssShDLlT_8oyukhqneFS9Zkgnh";

/* ========================================================= */
function LoginForm() {
  const navigate = useNavigate();
  const { executeRecaptcha } = useGoogleReCaptcha();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role] = useState("teacher");
  const [isLoading, setIsLoading] = useState(false);

  const navigateBasedOnRole = (r) => {
    if (r === "teacher") navigate("/dashboard-teacher");
    else if (r === "coordonator") navigate("/dashboard-coordo");
  };

  /* ================= EMAIL LOGIN ================= */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) return alert("Veuillez remplir tous les champs.");
    if (!executeRecaptcha) return alert("reCAPTCHA non chargé.");

    setIsLoading(true);

    try {
      const token = await executeRecaptcha("login");

      const captchaRes = await fetch(
        "https://us-central1-tp2appweb2-35f8c.cloudfunctions.net/api/verify-recaptcha",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }
      );

      const captchaData = await captchaRes.json();

      if (!captchaData.success) {
        alert("Échec de la vérification reCAPTCHA.");
        return;
      }

      const cred = await signInWithEmailAndPassword(auth, email, password);

      if (!cred.user.emailVerified) {
        await sendEmailVerification(cred.user);
        alert("Email non vérifié. Un lien vient d’être renvoyé.");
        await auth.signOut();
        return;
      }

      const userRef = doc(db, "users", cred.user.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        alert("Compte introuvable.");
        await auth.signOut();
        return;
      }

      navigateBasedOnRole(snap.data().role);
    } catch (err) {
      console.error(err);
      alert("Erreur de connexion.");
    } finally {
      setIsLoading(false);
    }
  };

  /* ================= RESET PASSWORD ================= */
  const handleResetPassword = async () => {
    if (!email) return alert("Entrez votre courriel.");
    await sendPasswordResetEmail(auth, email);
    alert("Email de réinitialisation envoyé.");
  };

  /* ================= SOCIAL LOGIN ================= */
  const socialLogin = async (provider, providerName) => {
    setIsLoading(true);

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        const names = (user.displayName || "").split(" ");
        await setDoc(userRef, {
          firstName: names[0] || "Prénom",
          lastName: names.slice(1).join(" ") || "Nom",
          email: user.email,
          role,
          provider: providerName.toLowerCase(),
          createdAt: new Date(),
        });
      }

      navigateBasedOnRole(role);
    } catch (err) {
      console.error(err);
      alert(`Erreur avec ${providerName}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-dark-bg text-white">
      <div className="hidden lg:flex w-1/2">
        <img src={maisonneuve} className="w-full h-full object-cover" />
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center">
        <div className="w-full max-w-md space-y-6 p-8">
          <h2 className="text-3xl font-bold text-center">Connexion</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="email" placeholder="Courriel" className="input-modern"
              value={email} onChange={(e) => setEmail(e.target.value)} />

            <input type="password" placeholder="Mot de passe" className="input-modern"
              value={password} onChange={(e) => setPassword(e.target.value)} />

            <button className="btn-primary w-full" disabled={isLoading}>
              {isLoading ? "Connexion..." : "Se connecter"}
            </button>
          </form>

          <button onClick={handleResetPassword}
            className="text-sm underline text-center w-full">
            Mot de passe oublié ?
          </button>

          <button onClick={() => socialLogin(googleProvider, "Google")}
            className="w-full bg-white text-black py-3 rounded-xl flex justify-center gap-2">
            <img src={googleLogo} className="w-6 h-6" />
            Continuer avec Google
          </button>

          <button onClick={() => socialLogin(githubProvider, "GitHub")}
            className="w-full bg-gray-900 py-3 rounded-xl">
            Continuer avec GitHub
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========================================================= */
export default function Login() {
  return (
    <GoogleReCaptchaProvider reCaptchaKey={RECAPTCHA_SITE_KEY}>
      <LoginForm />
    </GoogleReCaptchaProvider>
  );
}
