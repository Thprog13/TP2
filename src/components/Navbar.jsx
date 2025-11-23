import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import exitIcon from "../assets/exit.png"; 
import "./Navbar.css";

export default function Navbar() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const data = snap.data();
        setUserName(`${data.firstName} ${data.lastName}`);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    auth.signOut();
    navigate("/login");
  };

  return (
    <nav className="nav">
      <div className="nav-left">
        <h1 className="nav-logo">EnseignIA</h1>
      </div>

      <div className="nav-right">
        <span className="user-name">{userName}</span>

        <button className="logout-btn" onClick={handleLogout}>
          <img src={exitIcon} className="logout-icon" alt="logout" />
        </button>
      </div>
    </nav>
  );
}
