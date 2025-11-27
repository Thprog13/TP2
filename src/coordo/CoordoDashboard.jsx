// src/coordo/CoordoDashboard.jsx
import React, { useState } from "react";
import Navbar from "../components/Navbar";
import SidebarCoordo from "./SidebarCoordo";
import ManageForms from "./ManageForms";
import ValidatePlans from "./ValidatePlans";
import "../teacher/TeacherDashboard.css"; // Réutilisation du CSS

export default function CoordoDashboard() {
  const [activeTab, setActiveTab] = useState("forms");

  return (
    <>
      <Navbar />
      <div className="dashboard-container">
        <SidebarCoordo activeTab={activeTab} setActiveTab={setActiveTab} />

        <div className="dashboard-content">
          {activeTab === "forms" && <ManageForms />}
          {activeTab === "validate" && <ValidatePlans />}
        </div>
      </div>
    </>
  );
}
