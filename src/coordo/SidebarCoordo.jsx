import React from "react";
import checkIcon from "../assets/checked.png";
import editIcon from "../assets/edit.png";
import settingsIcon from "../assets/settings.png";

export default function SidebarCoordo({ activeTab, setActiveTab }) {
  const menu = [
    { id: "forms", label: "Gérer formulaires", icon: editIcon },
    { id: "validate", label: "Valider plans", icon: checkIcon },
    { id: "settings", label: "Paramètres", icon: settingsIcon },
  ];

  return (
    <div className="w-64 bg-dark-card border-r border-dark-border min-h-[calc(100vh-64px)] flex flex-col p-4 space-y-2">
      
      <div className="text-xs font-bold text-dark-muted uppercase tracking-wider mb-2 px-2">
        Coordination
      </div>

      {menu.map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveTab(item.id)}
          className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl transition-all font-medium ${
            activeTab === item.id
              ? "bg-purple-600 text-white shadow-lg shadow-purple-900/20"
              : "text-dark-muted hover:bg-dark-bg hover:text-white"
          }`}
        >
          <img src={item.icon} alt="" className="w-5 h-5 opacity-90" />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
