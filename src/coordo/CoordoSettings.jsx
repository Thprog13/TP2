import React, { useState } from "react";
import { auth } from "../firebase";
import { updateProfile } from "firebase/auth";

export default function CoordoSettings() {
  const user = auth.currentUser;
  const [name, setName] = useState(user?.displayName || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return alert("Nom invalide");

    setSaving(true);

    try {
      await updateProfile(user, { displayName: name });
      await user.reload();
      alert("Nom mis à jour avec succès!");
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la mise à jour du nom.");
    }

    setSaving(false);
  };

  const logout = () => auth.signOut();

  return (
    <div className="max-w-2xl mx-auto mt-10">
      <div className="card-modern">
        <h2 className="text-3xl font-bold text-white mb-8 border-b border-slate-700 pb-4">
          Paramètres du compte
        </h2>

        <div className="space-y-6">
          {/* Champ Nom */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Nom complet
            </label>
            <div className="flex gap-4">
              <input
                className="input-modern flex-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Votre nom"
              />
              <button
                className="btn-primary px-6 whitespace-nowrap"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "..." : "Sauvegarder"}
              </button>
            </div>
          </div>

          {/* Champ Email (Lecture seule) */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Email (Lecture seule)
            </label>
            <input
              className="input-modern bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed"
              value={user?.email || ""}
              disabled
            />
          </div>
        </div>

        {/* Zone de danger / Déconnexion */}
        <div className="mt-10 pt-6 border-t border-slate-700">
          <button
            className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold rounded-xl transition-all border border-red-500/20"
            onClick={logout}
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
