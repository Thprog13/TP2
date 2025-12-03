import React, { useState } from "react";
import maisonneuve from "./assets/maisonneuve.jpg";
import googleLogo from "./assets/Google.PNG";

import { auth, db } from "./firebase";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("teacher");

  const navigateBasedOnRole = (role) => {
    if (role === "teacher") navigate("/dashboard-teacher");
    else if (role === "coordonator") navigate("/dashboard-coordo");
    else alert(`Rôle inconnu: ${role}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return alert("Remplissez tous les champs.");

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);

      if (!cred.user.emailVerified) {
        try {
          await sendEmailVerification(cred.user);
          alert(
            "Votre adresse n'est pas vérifiée. Un email de vérification a été renvoyé. Vérifiez votre boîte mail puis reconnectez-vous."
          );
        } catch (e) {
          console.error('Erreur renvoi email vérification', e);
          alert(
            "Impossible de renvoyer l'email de vérification automatiquement. Veuillez vérifier votre boîte mail ou contacter l'administrateur."
          );
        }
        await auth.signOut();
        return;
      }

      const snap = await getDoc(doc(db, "users", cred.user.uid));

      if (!snap.exists()) return alert("Compte introuvable.");

      navigateBasedOnRole(snap.data().role);
    } catch (err) {
      console.error(err);
      alert("Erreur de connexion.");
    }
  };

  const handleResetPassword = async () => {
    if (!email || !email.trim()) {
      return alert("Entrez votre adresse courriel pour recevoir le lien de réinitialisation.");
    }

    try {
      await sendPasswordResetEmail(auth, email.trim());
      alert("Email de réinitialisation envoyé. Vérifiez votre boîte mail.");
    } catch (err) {
      console.error("Erreur envoi reset mot de passe", err);
      alert("Impossible d'envoyer l'email de réinitialisation. Vérifiez l'adresse ou réessayez plus tard.");
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const userRef = doc(db, "users", result.user.uid);
      const snap = await getDoc(userRef);

      let finalRole = role;

      if (snap.exists()) {
        finalRole = snap.data().role;
      } else {
        const names = (result.user.displayName || "").split(" ");
        await setDoc(userRef, {
          firstName: names[0] || "Prénom",
          lastName: names.slice(1).join(" ") || "Nom",
          email: result.user.email,
          role: finalRole,
          createdAt: new Date(),
        });
      }

      navigateBasedOnRole(finalRole);
    } catch (err) {
      console.error(err);
      alert("Erreur Google.");
    }
  };

  return (
    <div className="flex h-screen w-full bg-dark-bg text-dark-text overflow-hidden">
      
      {/* LEFT IMAGE PANEL */}
      <div className="hidden lg:flex w-1/2 relative items-center justify-center">
        <div className="absolute inset-0 bg-blue-900/40 z-10 mix-blend-multiply"></div>

        <img
          src={maisonneuve}
          alt="Campus"
          className="w-full h-full object-cover"
        />

        <div className="absolute bottom-10 left-10 z-20 bg-black/40 backdrop-blur-md p-6 rounded-2xl border border-white/10">
          <h1 className="text-4xl font-bold text-white mb-2">EnseignIA</h1>
          <p className="text-gray-200 text-lg">
            Plateforme de validation intelligente.
          </p>
        </div>
      </div>

      {/* LOGIN PANEL */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">

          <div className="text-center">
            <h2 className="text-3xl font-bold text-white mb-2">Connexion</h2>
            <p className="text-dark-muted">Accédez à votre espace</p>
          </div>

          {/* ROLE SELECTION */}
          <div className="flex bg-dark-card p-1 rounded-xl border border-dark-border">
            {["teacher", "coordonator"].map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  role === r
                    ? "bg-primary text-white shadow-lg"
                    : "text-dark-muted hover:text-white"
                }`}
              >
                {r === "teacher" ? "Enseignant" : "Coordonnateur"}
              </button>
            ))}
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <input
              type="email"
              placeholder="Courriel"
              className="input-modern"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <input
              type="password"
              placeholder="Mot de passe"
              className="input-modern"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <div className="text-right">
              <button
                type="button"
                onClick={handleResetPassword}
                className="text-sm text-primary hover:underline"
              >
                Mot de passe oublié ?
              </button>
            </div>

            <button type="submit" className="w-full btn-primary py-3 text-lg">
              Se connecter
            </button>
          </form>

          {/* SEPARATOR */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-dark-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-dark-bg text-dark-muted">OU</span>
            </div>
          </div>

          {/* GOOGLE LOGIN BUTTON — FINAL VERSION */}
          <button
            onClick={handleGoogleLogin}
            className="w-full py-3 bg-white text-gray-900 font-semibold rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center gap-3"
          >
            <img
              src={googleLogo}
              alt="Google"
              className="w-6 h-6"
            />
            <span className="text-base font-medium">Continuer avec Google</span>
          </button>

          {/* REGISTER LINK */}
          <p className="text-center text-dark-muted">
            Vous n'avez pas de compte ?{" "}
            <span
              onClick={() => navigate("/register")}
              className="text-primary hover:text-blue-400 cursor-pointer underline"
            >
             Inscrivez-vous
            </span>
          </p>

        </div>
      </div>
    </div>
  );
}
