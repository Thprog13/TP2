import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import exitIcon from "../assets/exit.png";

export default function Navbar() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const d = snap.data();
          setUserName(user.displayName || `${d.firstName} ${d.lastName}`);
          setUserRole(d.role === "teacher" ? "Enseignant" : "Coordonnateur");
        }
      }
    });

    return unsub;
  }, []);

  return (
    <nav className="h-16 bg-dark-card border-b border-dark-border flex items-center justify-between px-6 sticky top-0 z-50">
      
      {/* LOGO */}
      <div className="text-xl font-bold text-primary tracking-wide">
        EnseignIA
      </div>

      {/* recherche désactivée (affichage retiré) */}

      {/* USER + LOGOUT */}
      <div className="flex items-center gap-4">
        
        <div className="text-right hidden sm:block">
          <div className="text-sm font-semibold text-white">{userName}</div>
          <div className="text-xs text-dark-muted">{userRole}</div>
        </div>

        {/* LOGOUT ICON ONLY */}
        <button
          onClick={() => {
            auth.signOut();
            navigate("/login");
          }}
          className="bg-red-500/10 hover:bg-red-500/20 p-2 rounded-lg transition-colors"
        >
          <img src={exitIcon} alt="logout" className="w-5 h-5" />
        </button>
      </div>
    </nav>
  );
}
