import React, { useState } from "react";
import "./Login.css";
import maisonneuve from "./assets/maisonneuve.jpg";
import mailIcon from "./assets/mail.png";
import lockIcon from "./assets/padlock.png";
import enterIcon from "./assets/enter.png";
import { auth, db } from "./firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
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

    // Validation nom / prénom
    if (!/^[A-Z][A-Za-zÀ-ÖØ-öø-ÿ -]*$/.test(firstName)) {
      return alert(
        "Le prénom doit commencer par une majuscule et contenir uniquement des lettres, espaces ou tirets."
      );
    }

    if (!/^[A-Z][A-Za-zÀ-ÖØ-öø-ÿ -]*$/.test(lastName)) {
      return alert(
        "Le nom doit commencer par une majuscule et contenir uniquement des lettres, espaces ou tirets."
      );
    }

    if (password !== confirm) {
      alert("Les mots de passe ne correspondent pas.");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        firstName,
        lastName,
        email,
        role,
        createdAt: new Date(),
      });

      alert("Compte créé avec succès !");
      navigate("/login");
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la création du compte.");
    }
  };

  return (
    <div className="login-page">

      {/* Image */}
      <div className="left-panel">
        <img src={maisonneuve} alt="Cégep Maisonneuve" className="left-image" />
      </div>

      {/* Formulaire */}
      <div className="right-panel">
        <div className="login-box">
          <h1 className="login-title">Créer un compte</h1>

          {/* Rôle */}
          <div className="role">
            <button
              className={`r-btn ${role === "teacher" ? "active" : ""}`}
              onClick={() => setRole("teacher")}
            >
              Enseignant
            </button>

            <button
              className={`r-btn ${role === "coordonator" ? "active" : ""}`}
              onClick={() => setRole("coordonator")}
            >
              Coordonnateur
            </button>
          </div>

          <form onSubmit={handleSubmit}>

            {/* Prénom */}
            <div className="input-group">
              <label>Prénom</label>
              <div className="input-wrapper" style={{ paddingLeft: 0 }}>
                <input
                  type="text"
                  placeholder="Prénom"
                  value={firstName}
                  onChange={(e) => setFirstName(formatName(e.target.value))}
                  required
                  style={{ paddingLeft: "12px" }}
                />
              </div>
            </div>

            {/* Nom */}
            <div className="input-group">
              <label>Nom</label>
              <div className="input-wrapper" style={{ paddingLeft: 0 }}>
                <input
                  type="text"
                  placeholder="Nom"
                  value={lastName}
                  onChange={(e) => setLastName(formatName(e.target.value))}
                  required
                  style={{ paddingLeft: "12px" }}
                />
              </div>
            </div>

            {/* Email */}
            <div className="input-group">
              <label>Courriel</label>
              <div className="input-wrapper">
                <img src={mailIcon} className="input-icon" />
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div className="input-group">
              <label>Mot de passe</label>
              <div className="input-wrapper">
                <img src={lockIcon} className="input-icon" />
                <input
                  type="password"
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Confirmation */}
            <div className="input-group">
              <label>Confirmer le mot de passe</label>
              <div className="input-wrapper">
                <img src={lockIcon} className="input-icon" />
                <input
                  type="password"
                  placeholder="Confirmer"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Submit */}
            <button className="login-button" type="submit">
              Créer le compte
              <img src={enterIcon} className="btn-icon" />
            </button>
          </form>

          <div className="register-link">
            Déjà un compte ?{" "}
            <span onClick={() => navigate("/login")}>Se connecter</span>
          </div>

        </div>
      </div>

    </div>
  );
}
