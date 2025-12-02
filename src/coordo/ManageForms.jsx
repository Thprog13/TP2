import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  deleteDoc,
  query,
  orderBy,
  where,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";

const defaultCoursePlan = () => ({
  meta: { title: "", objective: "", description: "" },
  weeks: [{ id: 1, label: "Semaine 1", learning: "", homework: "" }],
  exams: [],
  questions: [
    {
      id: "q-title",
      label: "Titre du cours",
      rule: "Le titre doit être clair.",
    },
    { id: "q-obj", label: "Objectif", rule: "Objectif précis." },
  ],
});

export default function ManageForms() {
  const [coursePlan, setCoursePlan] = useState(defaultCoursePlan());
  const [activeFormId, setActiveFormId] = useState(null);
  const [templatesList, setTemplatesList] = useState([]);
  const user = auth.currentUser;

  useEffect(() => {
    if (user)
      getDocs(
        query(collection(db, "formTemplates"), orderBy("createdAt", "desc"))
      ).then((s) =>
        setTemplatesList(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      );
  }, [user]);

  const updateMeta = (f, v) =>
    setCoursePlan((p) => ({ ...p, meta: { ...p.meta, [f]: v } }));

  const saveForm = async () => {
    const payload = { ...coursePlan, updatedAt: serverTimestamp() };
    if (activeFormId)
      await updateDoc(doc(db, "formTemplates", activeFormId), payload);
    else {
      const ref = await addDoc(collection(db, "formTemplates"), {
        ...payload,
        createdAt: serverTimestamp(),
        active: true,
        creatorId: user.uid,
        type: "course-plan",
      });
      setActiveFormId(ref.id);
    }
    alert("Sauvegardé !");
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="card-modern">
        <div className="flex justify-between mb-6 border-b border-dark-border pb-4">
          <h2 className="text-2xl font-bold text-white">Éditeur de Modèle</h2>
          <button
            onClick={() => {
              setActiveFormId(null);
              setCoursePlan(defaultCoursePlan());
            }}
            className="text-sm bg-dark-bg px-3 py-1 rounded text-white"
          >
            Nouveau
          </button>
        </div>
        <div className="space-y-4">
          <input
            className="input-modern"
            value={coursePlan.meta.title}
            onChange={(e) => updateMeta("title", e.target.value)}
            placeholder="Titre par défaut"
          />
          {coursePlan.questions.map((q, i) => (
            <div
              key={i}
              className="bg-dark-bg/50 p-4 rounded-lg border border-dark-border"
            >
              <span className="font-bold text-white block mb-2">{q.label}</span>
              <input
                className="input-modern text-sm"
                value={q.rule}
                onChange={(e) => {
                  const n = [...coursePlan.questions];
                  n[i].rule = e.target.value;
                  setCoursePlan({ ...coursePlan, questions: n });
                }}
                placeholder="Règle IA..."
              />
            </div>
          ))}
        </div>
        <button onClick={saveForm} className="btn-primary w-full mt-8">
          Sauvegarder
        </button>
      </div>

      <div className="card-modern">
        <h3 className="text-xl font-bold text-white mb-4">Modèles</h3>
        <div className="space-y-2">
          {templatesList.map((t) => (
            <div
              key={t.id}
              className="flex justify-between items-center bg-dark-bg p-3 rounded-lg"
            >
              <span className="text-slate-300 text-sm">{t.id}</span>
              <button
                onClick={() => {
                  setActiveFormId(t.id);
                  setCoursePlan(t);
                }}
                className="text-blue-400 text-sm"
              >
                Modifier
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
