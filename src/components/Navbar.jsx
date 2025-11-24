import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";

import exitIcon from "../assets/exit.png";
import searchIcon from "../assets/search.png";
import "./Navbar.css";

export default function Navbar() {
  const navigate = useNavigate();

  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");

  const [searchText, setSearchText] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);

  const formatName = (value) => {
    if (!value) return "";
    let cleaned = value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ -]/g, "");
    cleaned = cleaned.replace(/\s+/g, " ");
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  };

  const roleMap = {
    teacher: "Enseignant",
    enseignant: "Enseignant",

    admin: "Coordonnateur",
    coordinator: "Coordonnateur",
    coordonator: "Coordonnateur",
    coordonnateur: "Coordonnateur"
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const data = snap.data();

        const fName = formatName(data.firstName);
        const lName = formatName(data.lastName);
        setUserName(`${fName} ${lName}`);

        const roleKey = data.role?.toLowerCase() || "";
        setUserRole(roleMap[roleKey] || data.role);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const loadUsers = async () => {
      const snap = await getDocs(collection(db, "users"));
      const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAllUsers(users);
    };

    loadUsers();
  }, []);

  useEffect(() => {
    if (searchText.trim() === "") {
      setFilteredUsers([]);
      return;
    }

    const results = allUsers.filter((u) =>
      `${u.firstName} ${u.lastName}`
        .toLowerCase()
        .includes(searchText.toLowerCase())
    );

    setFilteredUsers(results);
  }, [searchText, allUsers]);

  const handleLogout = () => {
    auth.signOut();
    navigate("/login");
  };

  return (
    <nav className="nav">
      {/* LEFT */}
      <div className="nav-left">
        <h1 className="nav-logo">EnseignIA</h1>
      </div>

      {/* CENTER SEARCH */}
      <div className="nav-search">
        <img src={searchIcon} alt="search" className="search-icon" />
        <input
          type="text"
          placeholder="Rechercher un professeur..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </div>

      {/* SEARCH DROPDOWN */}
      {filteredUsers.length > 0 && (
        <div className="search-results">
          {filteredUsers.map((u) => {
            const formattedFirst = formatName(u.firstName);
            const formattedLast = formatName(u.lastName);
            const roleKey = u.role.toLowerCase();
            const roleFr = roleMap[roleKey] || u.role;

            return (
              <div key={u.id} className="search-item">
                {formattedFirst} {formattedLast} — {roleFr}
              </div>
            );
          })}
        </div>
      )}

      {/* RIGHT */}
      <div className="nav-right">
        <span className="user-name">
          {userName} — {userRole}
        </span>
        <button className="logout-btn" onClick={handleLogout}>
          <img src={exitIcon} className="logout-icon" alt="logout" />
        </button>
      </div>
    </nav>
  );
}
