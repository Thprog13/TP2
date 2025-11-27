// src/coordo/SidebarCoordo.jsx
import React from "react";
import "../teacher/SidebarTeacher.css"; // On réutilise le style existant

export default function SidebarCoordo({ activeTab, setActiveTab }) {
  return (
    <div className="teacher-sidebar">
      <div className="sidebar-title">Coordination</div>

      <button
        className={`sidebar-btn ${activeTab === "forms" ? "active" : ""}`}
        onClick={() => setActiveTab("forms")}
      >
        Gérer les formulaires
      </button>

      <button
        className={`sidebar-btn ${activeTab === "validate" ? "active" : ""}`}
        onClick={() => setActiveTab("validate")}
      >
        Valider les plans
      </button>
    </div>
  );
}
