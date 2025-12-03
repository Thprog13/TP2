import React, { useState } from "react";
import maisonneuve from "./assets/maisonneuve.jpg";
import mailIcon from "./assets/mail.png";
import lockIcon from "./assets/padlock.png";
import enterIcon from "./assets/enter.png";

import { auth, db } from "./firebase";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function Register() {
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState("teacher");

  const formatName = (value) => {
    if (!value) return "";

    let cleaned = value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ -]/g, "");
    cleaned = cleaned.replace(/\s+/g, " ");
    cleaned = cleaned.replace(/-{2,}/g, "-");
    cleaned = cleaned.replace(/\s*-\s*/g, "-");
    cleaned = cleaned.trimStart();

    if (cleaned.length === 0) return "";

    cleaned = cleaned
      .split(" ")
      .map((segment) =>
        segment
          .split("-")
          .map(
            (part) =>
              part.charAt(0).toUpperCase() + part.slice(1)
          )
          .join("-")
      )
      .join(" ");

    return cleaned;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!/^[A-Z][A-Za-zÀ-ÖØ-öø-ÿ -]*$/.test(firstName)) {
      return alert("Le prénom doit commencer par une majuscule et contenir uniquement des lettres, espaces ou tirets.");
    }

    if (!/^[A-Z][A-Za-zÀ-ÖØ-öø-ÿ -]*$/.test(lastName)) {
      return alert("Le nom doit commencer par une majuscule et contenir uniquement des lettres, espaces ou tirets.");
    }

    if (password !== confirm) {
      return alert("Les mots de passe ne correspondent pas.");
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "users", cred.user.uid), {
        firstName,
        lastName,
        email,
        role,
        createdAt: new Date(),
      });

      try {
        await sendEmailVerification(cred.user);
      } catch (e) {
        console.error("Erreur envoi email vérification", e);
      }

      alert("Compte créé ! Un email de vérification vous a été envoyé. Veuillez vérifier votre boîte mail avant de vous connecter.");
      await auth.signOut();
      navigate("/login");
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la création du compte.");
    }
  };

  return (
    <div className="flex h-screen w-full bg-dark-bg text-dark-text overflow-hidden">
      
      {/* Left Image */}
      <div className="hidden lg:flex w-1/2 relative">
        <img
          src={maisonneuve}
          className="w-full h-full object-cover opacity-50"
        />
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-6">

          <h2 className="text-3xl font-bold text-center text-white">
            Créer un compte
          </h2>

          {/* ROLE TOGGLE */}
          <div className="flex bg-dark-card p-1 rounded-lg border border-dark-border">
            {["teacher", "coordonator"].map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`flex-1 py-2 rounded-md text-sm ${
                  role === r ? "bg-primary text-white" : "text-dark-muted"
                }`}
              >
                {r === "teacher" ? "Enseignant" : "Coordonnateur"}
              </button>
            ))}
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* First + Last Name */}
            <div className="flex gap-4">
              <input
                placeholder="Prénom"
                className="input-modern"
                value={firstName}
                onChange={(e) => setFirstName(formatName(e.target.value))}
                required
              />

              <input
                placeholder="Nom"
                className="input-modern"
                value={lastName}
                onChange={(e) => setLastName(formatName(e.target.value))}
                required
              />
            </div>

            {/* Email */}
            <div className="relative">
              <img src={mailIcon} className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 opacity-60" />
              <input
                type="email"
                placeholder="Courriel"
                className="input-modern pl-10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Password */}
            <div className="relative">
              <img src={lockIcon} className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 opacity-60" />
              <input
                type="password"
                placeholder="Mot de passe"
                className="input-modern pl-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {/* Confirm Password */}
            <div className="relative">
              <img src={lockIcon} className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 opacity-60" />
              <input
                type="password"
                placeholder="Confirmer"
                className="input-modern pl-10"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>

            {/* SUBMIT */}
            <button type="submit" className="w-full btn-primary py-3 flex items-center justify-center gap-2">
              Créer le compte
              <img src={enterIcon} className="w-5 h-5" />
            </button>
          </form>

          {/* Link */}
          <p className="text-center text-dark-muted">
            Vouz avez un compte ?{" "}
            <span onClick={() => navigate("/login")} className="text-primary cursor-pointer hover:underline">
              Connectez-vous
            </span>
          </p>

        </div>
      </div>
    </div>
  );
}
