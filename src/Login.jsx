import React, { useState } from "react";
import "./Login.css";
import maisonneuve from "./assets/maisonneuve.jpg";
import mailIcon from "./assets/mail.png";
import lockIcon from "./assets/padlock.png";
import enterIcon from "./assets/enter.png";
import { auth, db } from "./firebase";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // 'role' sert à l'affichage du toggle ET à définir le rôle par défaut
  // lors d'une première connexion Google
  const [role, setRole] = useState("teacher");

  const navigateBasedOnRole = (role) => {
    if (role === "teacher") {
      navigate("/dashboard-teacher");
    } else if (role === "coordonator") {
      navigate("/dashboard-coordo");
    } else {
      alert(`Rôle utilisateur inconnu (${role}). Accès refusé.`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      alert("Veuillez remplir tous les champs.");
      return;
    }

    try {
      // 1. Authentification Firebase
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // 2. Récupération du rôle dans Firestore
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        alert("Aucun profil utilisateur trouvé. Contactez l'administrateur.");
        return;
      }

      const storedRole = snap.data().role;
      navigateBasedOnRole(storedRole);
    } catch (err) {
      console.error(err);
      alert("Email ou mot de passe incorrect.");
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Vérifier si l'utilisateur existe déjà dans Firestore
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      let finalRole = role; // Par défaut, on utilise le rôle sélectionné dans le toggle

      if (userSnap.exists()) {
        // L'utilisateur existe déjà : on respecte son rôle enregistré
        finalRole = userSnap.data().role;
      } else {
        // Nouvel utilisateur : on crée son profil avec le rôle sélectionné
        // On sépare le displayName en Prénom / Nom (approximation)
        const names = (user.displayName || "").split(" ");
        const firstName = names[0] || "Prénom";
        const lastName = names.slice(1).join(" ") || "Nom";

        await setDoc(userRef, {
          firstName,
          lastName,
          email: user.email,
          role: finalRole, // <-- Le rôle vient du bouton (Enseignant/Coordo) actif à l'écran
          createdAt: new Date(),
        });

        alert(
          `Compte créé avec succès en tant que ${
            finalRole === "teacher" ? "Enseignant" : "Coordonnateur"
          } !`
        );
      }

      navigateBasedOnRole(finalRole);
    } catch (err) {
      console.error("Erreur Google:", err);
      alert("Erreur lors de la connexion Google.");
    }
  };

  return (
    <div className="login-page">
      {/* Image gauche */}
      <div className="left-panel">
        <img src={maisonneuve} alt="Cégep Maisonneuve" className="left-image" />
      </div>

      {/* Formulaire */}
      <div className="right-panel">
        <div className="login-box">
          <h1 className="login-title">Connexion</h1>

          {/* Toggle des rôles */}
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
            {/* Email */}
            <div className="input-group">
              <label>Courriel</label>
              <div className="input-wrapper">
                <img src={mailIcon} alt="Mail icon" className="input-icon" />
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
                <img src={lockIcon} alt="Lock icon" className="input-icon" />
                <input
                  type="password"
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Bouton Connexion Classique */}
            <button className="login-button" type="submit">
              Se connecter
              <img src={enterIcon} alt="Enter icon" className="btn-icon" />
            </button>
          </form>

          <div
            style={{ display: "flex", alignItems: "center", margin: "20px 0" }}
          >
            <div style={{ flex: 1, height: "1px", background: "#ddd" }}></div>
            <span
              style={{ padding: "0 10px", color: "#666", fontSize: "13px" }}
            >
              OU
            </span>
            <div style={{ flex: 1, height: "1px", background: "#ddd" }}></div>
          </div>

          {/* Bouton Google */}
          <button
            className="login-button"
            onClick={handleGoogleLogin}
            style={{ background: "#db4437", marginTop: "0" }} // Rouge Google
            type="button"
          >
            Se connecter avec Google
          </button>

          {/* Lien vers Register */}
          <div className="register-link">
            Pas de compte ?{" "}
            <span onClick={() => navigate("/register")}>
              Créer un compte courriel
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
