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

const useAuthInfo = () => {
  const [authInfo, setAuthInfo] = useState({
    currentUserId: null,
    userRole: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const ref = doc(db, "users", user.uid);
          const snap = await getDoc(ref);
          setAuthInfo({
            currentUserId: user.uid,
            userRole: snap.exists() ? snap.data().role : null,
          });
        } catch (error) {
          setAuthInfo({ currentUserId: user.uid, userRole: null });
        }
      } else {
        setAuthInfo({ currentUserId: null, userRole: null });
      }
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);
  return { ...authInfo, isLoading };
};

const defaultCoursePlan = () => ({
  meta: { title: "", objective: "", description: "" },
  weeks: [{ id: 1, label: "Semaine 1", learning: "", homework: "" }],
  exams: [],
  questions: [
    {
      id: "q-title",
      label: "Titre du cours",
      field: "meta.title",
      rule: "Le titre doit être non vide, clair et contenir entre 5 et 80 caractères.",
    },
    {
      id: "q-objective",
      label: "Objectif du cours",
      field: "meta.objective",
      rule: "L’objectif doit décrire les compétences visées en 1-3 phrases et inclure au moins 15 mots.",
    },
    {
      id: "q-description",
      label: "Description du cours",
      field: "meta.description",
      rule: "La description doit détailler les contenus, inclure les méthodes d’enseignement et faire au moins 100 mots.",
    },
    {
      id: "q-weeks",
      label: "Planification hebdomadaire",
      field: "weeks",
      rule: "Chaque semaine doit spécifier clairement: (1) ce qui sera appris, (2) le travail à réaliser à la maison. Éviter les champs vides.",
    },
    {
      id: "q-exams",
      label: "Évaluations (examens)",
      field: "exams",
      rule: "Lister les évaluations avec un titre, une date (si connue), et la matière couverte. Au moins une évaluation pour un cours crédité.",
    },
  ],
});

export default function ManageForms() {
  const [coursePlan, setCoursePlan] = useState(defaultCoursePlan());
  const [activeFormId, setActiveFormId] = useState(null);
  const [templatesList, setTemplatesList] = useState([]);
  const { currentUserId, userRole, isLoading } = useAuthInfo();

  const loadForms = async () => {
    if (isLoading || !currentUserId || !userRole) return;
    const formsQuery =
      userRole === "coordonator"
        ? query(
            collection(db, "formTemplates"),
            where("creatorId", "==", currentUserId)
          )
        : query(collection(db, "formTemplates"), orderBy("createdAt", "desc"));

    const allSnap = await getDocs(formsQuery);
    let loadedTemplates = allSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    loadedTemplates.sort((a, b) => {
      const ta = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
      const tb = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
      return tb - ta;
    });

    setTemplatesList(loadedTemplates);
    if (loadedTemplates.length > 0) editTemplate(loadedTemplates[0]);
    else setCoursePlan(defaultCoursePlan());
  };

  useEffect(() => {
    loadForms();
  }, [currentUserId, userRole, isLoading]);

  const updateMeta = (field, value) =>
    setCoursePlan((prev) => ({
      ...prev,
      meta: { ...prev.meta, [field]: value },
    }));

  const addWeek = () =>
    setCoursePlan((prev) => ({
      ...prev,
      weeks: [
        ...prev.weeks,
        {
          id: Date.now(),
          label: `Semaine ${prev.weeks.length + 1}`,
          learning: "",
          homework: "",
        },
      ],
    }));

  const updateWeek = (i, f, v) => {
    const weeks = [...coursePlan.weeks];
    weeks[i][f] = v;
    setCoursePlan({ ...coursePlan, weeks });
  };

  const removeWeek = (i) => {
    const weeks = [...coursePlan.weeks];
    weeks.splice(i, 1);
    const relabeled = weeks.map((w, idx) => ({
      ...w,
      label: `Semaine ${idx + 1}`,
    }));
    setCoursePlan({ ...coursePlan, weeks: relabeled });
  };

  const addExam = () =>
    setCoursePlan((prev) => ({
      ...prev,
      exams: [
        ...prev.exams,
        { id: Date.now(), title: "", date: "", coverage: "" },
      ],
    }));

  const updateExam = (i, f, v) => {
    const exams = [...coursePlan.exams];
    exams[i][f] = v;
    setCoursePlan({ ...coursePlan, exams });
  };

  const removeExam = (i) => {
    const exams = [...coursePlan.exams];
    exams.splice(i, 1);
    setCoursePlan({ ...coursePlan, exams });
  };

  const deleteTemplate = async (id) => {
    if (!window.confirm("Supprimer ce modèle ?")) return;
    await deleteDoc(doc(db, "formTemplates", id));
    setTemplatesList((prev) => prev.filter((t) => t.id !== id));
    if (activeFormId === id) {
      setActiveFormId(null);
      setCoursePlan(defaultCoursePlan());
    }
  };

  const editTemplate = (t) => {
    setActiveFormId(t.id);
    setCoursePlan({
      meta: t.meta || { title: "", objective: "", description: "" },
      weeks: t.weeks || [],
      exams: t.exams || [],
      questions: t.questions || defaultCoursePlan().questions,
    });
  };

  // --- Sauvegarde avec un seul actif ---
  const saveForm = async () => {
    if (!coursePlan.meta.title.trim()) return alert("Titre requis.");
    const payload = {
      ...coursePlan,
      updatedAt: serverTimestamp(),
      active: true,
    };

    try {
      // Désactiver l'ancien actif
      const activeSnap = await getDocs(
        query(collection(db, "formTemplates"), where("active", "==", true))
      );
      await Promise.all(
        activeSnap.docs
          .map((docSnap) => {
            if (docSnap.id !== activeFormId) {
              return updateDoc(doc(db, "formTemplates", docSnap.id), {
                active: false,
              });
            }
            return null;
          })
          .filter(Boolean)
      );

      // Mise à jour ou création
      if (activeFormId) {
        await updateDoc(doc(db, "formTemplates", activeFormId), payload);
      } else {
        const ref = await addDoc(collection(db, "formTemplates"), {
          ...payload,
          createdAt: serverTimestamp(),
          creatorId: currentUserId,
          type: "course-plan",
        });
        setActiveFormId(ref.id);
      }

      await loadForms();
      alert("Sauvegardé !");
    } catch (e) {
      console.error(e);
      alert("Erreur sauvegarde");
    }
  };

  // --- Fonction pour activer manuellement un modèle ---
  const toggleActive = async (id) => {
    try {
      const activeSnap = await getDocs(
        query(collection(db, "formTemplates"), where("active", "==", true))
      );
      await Promise.all(
        activeSnap.docs
          .map((docSnap) => {
            if (docSnap.id !== id) {
              return updateDoc(doc(db, "formTemplates", docSnap.id), {
                active: false,
              });
            }
            return null;
          })
          .filter(Boolean)
      );
      await updateDoc(doc(db, "formTemplates", id), { active: true });
      await loadForms();
    } catch (e) {
      console.error(e);
      alert("Erreur lors du changement de statut");
    }
  };

  if (isLoading) return <div className="p-8 text-white">Chargement...</div>;
  if (!userRole) return <div className="p-8 text-red-400">Accès refusé.</div>;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      {/* Formulaire création/modification */}
      <div className="card-modern">
        <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
          <h2 className="text-2xl font-bold text-white">
            {activeFormId ? "Modifier le modèle" : "Créer un nouveau modèle"}
          </h2>
          <button
            onClick={() => {
              setActiveFormId(null);
              setCoursePlan(defaultCoursePlan());
            }}
            className="text-sm bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            + Nouveau
          </button>
        </div>

        {/* Informations générales */}
        <div className="space-y-4 mb-8">
          <h3 className="text-lg font-semibold text-blue-400">
            1. Informations générales
          </h3>
          <div className="grid gap-4">
            <div>
              <label className="text-sm text-slate-400 block mb-1">
                Titre du cours
              </label>
              <input
                className="input-modern"
                value={coursePlan.meta.title}
                onChange={(e) => updateMeta("title", e.target.value)}
                placeholder="Ex: Programmation Web 2"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">
                Objectif
              </label>
              <textarea
                className="input-modern min-h-[80px]"
                value={coursePlan.meta.objective}
                onChange={(e) => updateMeta("objective", e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">
                Description
              </label>
              <textarea
                className="input-modern min-h-[100px]"
                value={coursePlan.meta.description}
                onChange={(e) => updateMeta("description", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Semaines */}
        <div className="space-y-4 mb-8">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-blue-400">
              2. Semaines ({coursePlan.weeks.length})
            </h3>
            <button
              onClick={addWeek}
              className="text-sm text-blue-400 border border-blue-500/30 px-3 py-1 rounded hover:bg-blue-500/10"
            >
              + Ajouter
            </button>
          </div>
          <div className="space-y-4">
            {coursePlan.weeks.map((w, i) => (
              <div
                key={w.id}
                className="bg-slate-900/50 p-4 rounded-xl border border-slate-700"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-white">{w.label}</span>
                  <button
                    onClick={() => removeWeek(i)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Supprimer
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    className="input-modern text-sm"
                    placeholder="Apprentissage..."
                    value={w.learning}
                    onChange={(e) => updateWeek(i, "learning", e.target.value)}
                  />
                  <input
                    className="input-modern text-sm"
                    placeholder="Devoirs..."
                    value={w.homework}
                    onChange={(e) => updateWeek(i, "homework", e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Examens */}
        <div className="space-y-4 mb-8">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-blue-400">
              3. Évaluations ({coursePlan.exams.length})
            </h3>
            <button
              onClick={addExam}
              className="text-sm text-blue-400 border border-blue-500/30 px-3 py-1 rounded hover:bg-blue-500/10"
            >
              + Ajouter
            </button>
          </div>
          <div className="space-y-4">
            {coursePlan.exams.map((ex, i) => (
              <div
                key={ex.id}
                className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 flex gap-4 items-start"
              >
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input
                    className="input-modern text-sm"
                    placeholder="Titre examen"
                    value={ex.title}
                    onChange={(e) => updateExam(i, "title", e.target.value)}
                  />
                  <input
                    className="input-modern text-sm"
                    placeholder="Date"
                    value={ex.date}
                    onChange={(e) => updateExam(i, "date", e.target.value)}
                  />
                  <input
                    className="input-modern text-sm"
                    placeholder="Matière..."
                    value={ex.coverage}
                    onChange={(e) => updateExam(i, "coverage", e.target.value)}
                  />
                </div>
                <button
                  onClick={() => removeExam(i)}
                  className="text-red-400 hover:text-red-300 pt-2"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Règles IA */}
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-700">
          <h3 className="text-lg font-semibold text-purple-400 mb-4">
            🤖 Règles de validation IA
          </h3>
          <div className="space-y-4">
            {coursePlan.questions.map((q, i) => (
              <div key={q.id}>
                <label className="text-sm font-bold text-white block mb-1">
                  {q.label}
                </label>
                <input
                  className="input-modern text-sm border-purple-500/30 focus:ring-purple-500"
                  value={q.rule}
                  onChange={(e) => {
                    const n = [...coursePlan.questions];
                    n[i].rule = e.target.value;
                    setCoursePlan({ ...coursePlan, questions: n });
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={saveForm}
          className="btn-primary w-full mt-8 text-lg py-3"
        >
          {activeFormId ? "Mettre à jour le modèle" : "Sauvegarder le modèle"}
        </button>
      </div>

      {/* Liste des modèles */}
      <div className="card-modern">
        <h3 className="text-xl font-bold text-white mb-4">
          Modèles enregistrés
        </h3>
        <div className="space-y-3">
          {templatesList.map((t) => (
            <div
              key={t.id}
              className="flex justify-between items-center bg-slate-900 p-4 rounded-lg border border-slate-700 hover:border-blue-500/50 transition-colors"
            >
              <div>
                <div className="text-sm font-mono text-slate-400">{t.id}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {t.createdAt?.toDate
                    ? t.createdAt.toDate().toLocaleDateString()
                    : "Date inconnue"}{" "}
                  {t.active && (
                    <span className="ml-2 text-green-500 font-bold">
                      • ACTIF
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => editTemplate(t)}
                  className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                >
                  Modifier
                </button>

                <button
                  onClick={() => deleteTemplate(t.id)}
                  className="text-red-400 hover:text-red-300 text-sm font-medium"
                >
                  Supprimer
                </button>

                <button
                  onClick={() => toggleActive(t.id)}
                  className={`text-sm font-medium px-2 py-1 rounded ${
                    t.active
                      ? "bg-green-500 text-white"
                      : "bg-slate-700 text-slate-300"
                  }`}
                >
                  {t.active ? "Actif" : "Activer"}
                </button>
              </div>
            </div>
          ))}
          {templatesList.length === 0 && (
            <p className="text-slate-500">Aucun modèle trouvé.</p>
          )}
        </div>
      </div>
    </div>
  );
}
