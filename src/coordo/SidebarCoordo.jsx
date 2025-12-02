import React from "react";

export default function SidebarCoordo({ activeTab, setActiveTab }) {
  const menu = [
    { id: "forms", label: "📝 Gérer formulaires" },
    { id: "validate", label: "✅ Valider plans" },
    { id: "settings", label: "⚙️ Paramètres" },
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
          className={`w-full text-left px-4 py-3 rounded-xl transition-all font-medium ${
            activeTab === item.id
              ? "bg-purple-600 text-white shadow-lg"
              : "text-dark-muted hover:bg-dark-bg hover:text-white"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
