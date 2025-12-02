import React, { useState } from "react";
import { auth } from "../firebase";
import { updateProfile } from "firebase/auth";

export default function TeacherSettings() {
  const user = auth.currentUser;
  const [name, setName] = useState(user?.displayName || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return alert("Nom invalide");
    setSaving(true);
    try {
      await updateProfile(user, { displayName: name });
      await user.reload();
      alert("Nom mis à jour !");
    } catch (error) {
      console.error(error);
    }
    setSaving(false);
  };

  return (
    <div className="max-w-xl mx-auto mt-10 card-modern">
      <h2 className="text-2xl font-bold text-white mb-6">Paramètres</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-dark-muted mb-1">
            Nom complet
          </label>
          <div className="flex gap-2">
            <input
              className="input-modern"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button
              className="btn-primary whitespace-nowrap"
              onClick={handleSave}
              disabled={saving}
            >
              Sauvegarder
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm text-dark-muted mb-1">Email</label>
          <input
            className="input-modern opacity-50 cursor-not-allowed"
            value={user.email}
            disabled
          />
        </div>
        <div className="pt-4 border-t border-dark-border">
          <button className="w-full btn-danger" onClick={() => auth.signOut()}>
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
