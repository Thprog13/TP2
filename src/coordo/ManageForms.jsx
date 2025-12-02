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

// Génère une clé à partir d'un libellé
const slugifyKey = (txt) =>
  (txt || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || `field_${Math.random().toString(36).slice(2, 7)}`;

const defaultCoursePlan = () => ({
  templateName: "",
  // Champs dynamiques définis par le coordonnateur pour “Informations générales”
  metaFields: [
    {
      id: `mf-${Date.now()}-1`,
      key: "title",
      label: "Titre du cours",
      type: "text",
      required: true,
      placeholder: "Ex: Programmation Web 2",
    },
    {
      id: `mf-${Date.now()}-2`,
      key: "objective",
      label: "Objectif",
      type: "textarea",
      required: false,
      placeholder: "",
    },
    {
      id: `mf-${Date.now()}-3`,
      key: "description",
      label: "Description",
      type: "textarea",
      required: false,
      placeholder: "",
    },
  ],
  weeks: [{ id: 1, label: "Semaine 1", learning: "", homework: "" }],
  exams: [],
  questions: [],
  aiRules: [], // Règles principales indépendantes
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

  // Semaines
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

  // Examens
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

  // Questions
  const addQuestion = () =>
    setCoursePlan((prev) => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          id: `q-${Date.now()}`,
          label: "",
          field: "",
          rule: "",
        },
      ],
    }));

  const updateQuestion = (index, key, value) => {
    setCoursePlan((prev) => {
      const qs = [...prev.questions];
      qs[index] = { ...qs[index], [key]: value };
      return { ...prev, questions: qs };
    });
  };

  const removeQuestion = (index) => {
    setCoursePlan((prev) => {
      const qs = [...prev.questions];
      qs.splice(index, 1);
      return { ...prev, questions: qs };
    });
  };

  // Règles principales indépendantes
  const addRule = () =>
    setCoursePlan((prev) => ({
      ...prev,
      aiRules: [...prev.aiRules, { id: `r-${Date.now()}`, text: "" }],
    }));

  const updateRule = (index, value) =>
    setCoursePlan((prev) => {
      const rs = [...prev.aiRules];
      rs[index] = { ...rs[index], text: value };
      return { ...prev, aiRules: rs };
    });

  const removeRule = (index) =>
    setCoursePlan((prev) => {
      const rs = [...prev.aiRules];
      rs.splice(index, 1);
      return { ...prev, aiRules: rs };
    });

  // Champs dynamiques - Informations générales
  const addMetaField = () =>
    setCoursePlan((prev) => {
      const id = `mf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      return {
        ...prev,
        metaFields: [
          ...prev.metaFields,
          {
            id,
            key: `field_${prev.metaFields.length + 1}`,
            label: "",
            type: "text",
            required: false,
            placeholder: "",
          },
        ],
      };
    });

  const updateMetaField = (index, keyName, value) =>
    setCoursePlan((prev) => {
      const arr = [...(prev.metaFields || [])];
      const next = { ...arr[index], [keyName]: value };
      if (
        keyName === "label" &&
        (!arr[index].key || arr[index].key.startsWith("field_"))
      ) {
        next.key = slugifyKey(value);
      }
      if (keyName === "key") {
        next.key = slugifyKey(value);
      }
      arr[index] = next;
      return { ...prev, metaFields: arr };
    });

  const removeMetaField = (index) =>
    setCoursePlan((prev) => {
      const arr = [...(prev.metaFields || [])];
      arr.splice(index, 1);
      return { ...prev, metaFields: arr };
    });

  // CRUD templates
  const deleteTemplate = async (id) => {
    if (!window.confirm("Supprimer ce modèle ?")) return;
    await deleteDoc(doc(db, "formTemplates", id));
    setTemplatesList((prev) => prev.filter((t) => t.id !== id));
    if (activeFormId === id) {
      setActiveFormId(null);
      setCoursePlan(defaultCoursePlan());
    }
  };

  const migrateMetaToFields = (metaObj) => {
    if (!metaObj || typeof metaObj !== "object") return [];
    const fields = [];
    const pushField = (key, label, type = "text") =>
      fields.push({
        id: `mf-${Date.now()}-${Math.random()}`,
        key,
        label,
        type,
        required: key === "title",
        placeholder:
          key === "title"
            ? "Ex: Programmation Web 2"
            : key === "objective"
            ? ""
            : key === "description"
            ? ""
            : "",
      });

    if (metaObj.title !== undefined) pushField("title", "Titre du cours", "text");
    if (metaObj.objective !== undefined)
      pushField("objective", "Objectif", "textarea");
    if (metaObj.description !== undefined)
      pushField("description", "Description", "textarea");

    Object.keys(metaObj)
      .filter((k) => !["title", "objective", "description"].includes(k))
      .forEach((k) =>
        fields.push({
          id: `mf-${Date.now()}-${Math.random()}`,
          key: slugifyKey(k),
          label: k,
          type: "text",
          required: false,
          placeholder: "",
        })
      );
    return fields;
  };

  const editTemplate = (t) => {
    setActiveFormId(t.id);
    setCoursePlan({
      templateName: t.templateName || t.meta?.title || "",
      metaFields: Array.isArray(t.metaFields)
        ? t.metaFields
        : migrateMetaToFields(t.meta),
      weeks: t.weeks || [],
      exams: t.exams || [],
      questions: t.questions || [],
      aiRules: t.aiRules || [],
    });
  };

  // Sauvegarde (plusieurs actifs possibles)
  const saveForm = async () => {
    if (!coursePlan.templateName?.trim())
      return alert("Nom du modèle requis.");
    if (!coursePlan.metaFields || coursePlan.metaFields.length === 0)
      return alert(
        "Ajoutez au moins un champ dans la section Informations générales."
      );

    const payload = {
      templateName: coursePlan.templateName.trim(),
      metaFields: coursePlan.metaFields,
      weeks: coursePlan.weeks,
      exams: coursePlan.exams,
      questions: coursePlan.questions,
      aiRules: coursePlan.aiRules,
      updatedAt: serverTimestamp(),
    };

    try {
      if (activeFormId) {
        await updateDoc(doc(db, "formTemplates", activeFormId), payload);
      } else {
        await addDoc(collection(db, "formTemplates"), {
          ...payload,
          active: true,
          createdAt: serverTimestamp(),
          creatorId: currentUserId,
          type: "course-plan",
        });
      }
      await loadForms();
      alert("Sauvegardé !");
    } catch (e) {
      console.error(e);
      alert("Erreur sauvegarde");
    }
  };

  // Activer/Désactiver un modèle (sans affecter les autres)
  const toggleActive = async (id, currentActive) => {
    try {
      await updateDoc(doc(db, "formTemplates", id), {
        active: !currentActive,
        updatedAt: serverTimestamp(),
      });
      setTemplatesList((prev) =>
        prev.map((t) => (t.id === id ? { ...t, active: !currentActive } : t))
      );
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

        {/* Nom du modèle */}
        <div className="space-y-2 mb-8">
          <label className="text-sm text-slate-400 block mb-1">
            Nom du modèle
          </label>
          <input
            className="input-modern"
            placeholder="Ex: Plan - Prog Web 2 (Hiver)"
            value={coursePlan.templateName}
            onChange={(e) =>
              setCoursePlan((p) => ({ ...p, templateName: e.target.value }))
            }
          />
        </div>

        {/* Informations générales (champs dynamiques) */}
        <div className="space-y-4 mb-8">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-blue-400">
              1. Informations générales — champs (
              {coursePlan.metaFields?.length || 0})
            </h3>
            <button
              onClick={addMetaField}
              className="text-sm text-blue-400 border border-blue-500/30 px-3 py-1 rounded hover:bg-blue-500/10"
            >
              + Ajouter un champ
            </button>
          </div>

          {(!coursePlan.metaFields || coursePlan.metaFields.length === 0) && (
            <p className="text-slate-500 text-sm">
              Aucun champ. Ajoutez des champs comme “Titre du cours”,
              “Objectif”, “Description”, etc.
            </p>
          )}

          <div className="space-y-4">
            {(coursePlan.metaFields || []).map((f, i) => (
              <div
                key={f.id}
                className="bg-slate-900/50 p-4 rounded-xl border border-slate-700"
              >
                <div className="flex justify-between items-start mb-3">
                  <span className="font-bold text-white">Champ #{i + 1}</span>
                  <button
                    onClick={() => removeMetaField(i)}
                    className="text-red-400 hover:text-red-300 text-xs"
                  >
                    Supprimer
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Libellé
                    </label>
                    <input
                      className="input-modern text-sm"
                      placeholder="Ex: Titre du cours"
                      value={f.label}
                      onChange={(e) =>
                        updateMetaField(i, "label", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Clé
                    </label>
                    <input
                      className="input-modern text-sm"
                      placeholder="Ex: title"
                      value={f.key}
                      onChange={(e) =>
                        updateMetaField(i, "key", e.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Type
                    </label>
                    <select
                      className="input-modern text-sm"
                      value={f.type}
                      onChange={(e) =>
                        updateMetaField(i, "type", e.target.value)
                      }
                    >
                      <option value="text">Texte</option>
                      <option value="textarea">Zone de texte</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-slate-400 block mb-1">
                      Placeholder
                    </label>
                    <input
                      className="input-modern text-sm"
                      placeholder="Ex: Indiquez l’objectif principal du cours…"
                      value={f.placeholder || ""}
                      onChange={(e) =>
                        updateMetaField(i, "placeholder", e.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={!!f.required}
                      onChange={(e) =>
                        updateMetaField(i, "required", e.target.checked)
                      }
                    />
                    Requis
                  </label>
                </div>
              </div>
            ))}
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

        {/* Questions dynamiques */}
        <div className="space-y-4 mb-8">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-purple-400">
              4. Questions du plan ({coursePlan.questions.length})
            </h3>
            <button
              onClick={addQuestion}
              className="text-sm text-purple-400 border border-purple-500/30 px-3 py-1 rounded hover:bg-purple-500/10"
            >
              + Ajouter une question
            </button>
          </div>
          <p className="text-xs text-slate-400">
            Ajoutez des questions (ex: Comment rejoindre le prof ?) et une
            règle de validation IA pour chaque question.
          </p>
          <div className="space-y-4">
            {coursePlan.questions.map((q, i) => (
              <div
                key={q.id}
                className="bg-slate-900/50 p-4 rounded-xl border border-slate-700"
              >
                <div className="flex justify-between items-start mb-3">
                  <span className="font-bold text-white">Question #{i + 1}</span>
                  <button
                    onClick={() => removeQuestion(i)}
                    className="text-red-400 hover:text-red-300 text-xs"
                  >
                    Supprimer
                  </button>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Intitulé
                    </label>
                    <input
                      className="input-modern text-sm"
                      placeholder="Ex: Comment rejoindre le prof ?"
                      value={q.label}
                      onChange={(e) =>
                        updateQuestion(i, "label", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Champ lié (optionnel)
                    </label>
                    <input
                      className="input-modern text-sm"
                      placeholder="Ex: meta.title / weeks / null"
                      value={q.field || ""}
                      onChange={(e) =>
                        updateQuestion(i, "field", e.target.value)
                      }
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="text-xs text-slate-400 block mb-1">
                    Règle de validation IA
                  </label>
                  <textarea
                    className="input-modern min-h-[70px] text-sm"
                    placeholder="Ex: Doit contenir email + heures de disponibilité. ≥ 20 mots."
                    value={q.rule}
                    onChange={(e) => updateQuestion(i, "rule", e.target.value)}
                  />
                </div>
              </div>
            ))}
            {coursePlan.questions.length === 0 && (
              <div className="text-slate-500 text-sm">
                Aucune question. Ajoutez-en.
              </div>
            )}
          </div>
        </div>

        {/* Règles principales (indépendantes) */}
        <div className="space-y-4 mb-8">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-purple-400">
              5. Règles principales (indépendantes) ({coursePlan.aiRules.length})
            </h3>
            <button
              onClick={addRule}
              className="text-sm text-purple-400 border border-purple-500/30 px-3 py-1 rounded hover:bg-purple-500/10"
            >
              + Ajouter une règle
            </button>
          </div>

          {coursePlan.aiRules.length === 0 && (
            <p className="text-slate-500 text-sm">
              Aucune règle principale. Exemple: “Chaque semaine précise
              apprentissage et devoirs”, “Au moins une évaluation”, “Titre
              5–80 caractères”.
            </p>
          )}

          <div className="space-y-3">
            {coursePlan.aiRules.map((r, i) => (
              <div
                key={r.id}
                className="bg-slate-900 p-4 rounded-xl border border-slate-700"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-white">Règle #{i + 1}</span>
                  <button
                    onClick={() => removeRule(i)}
                    className="text-red-400 hover:text-red-300 text-xs"
                  >
                    Supprimer
                  </button>
                </div>
                <textarea
                  className="input-modern min-h-[70px] text-sm"
                  placeholder="Décrivez la règle IA globale."
                  value={r.text}
                  onChange={(e) => updateRule(i, e.target.value)}
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
                <div className="text-sm font-semibold text-white">
                  {t.templateName || t.meta?.title || "Sans titre"}
                </div>
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
                  onClick={() => toggleActive(t.id, t.active)}
                  className={`text-sm font-medium px-2 py-1 rounded ${
                    t.active
                      ? "bg-slate-700 text-slate-200"
                      : "bg-green-500 text-white"
                  }`}
                >
                  {t.active ? "Désactiver" : "Activer"}
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