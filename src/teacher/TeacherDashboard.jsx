// src/teacher/TeacherDashboard.jsx
import React, { useEffect, useState } from "react";
import SidebarTeacher from "./SidebarTeacher";
import TeacherSettings from "./TeacherSettings";
import TeacherSubmits from "./TeacherSubmits";
import Navbar from "../components/Navbar";
import "./TeacherDashboard.css";

import { auth, db, storage } from "../firebase";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  doc,
  orderBy,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { jsPDF } from "jspdf";

// Format date + heure
const formatDateTime = (ts) => {
  if (!ts) return "N/A";
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Titre à partir des metaFields + valeurs
const getTitleFromMeta = (metaFields = [], metaValues = {}) => {
  // Priorité: champ key === "title"
  const byKey = metaFields.find((f) => f.key === "title");
  if (byKey) {
    const v = (metaValues || {})[byKey.key];
    if (v && String(v).trim()) return String(v).trim();
  }
  // Sinon, label contenant "titre"
  const byLabel = metaFields.find(
    (f) => (f.label || "").toLowerCase().includes("titre")
  );
  if (byLabel) {
    const v = (metaValues || {})[byLabel.key];
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
};

// Migration ancienne metaSnapshot (title/objective/description) -> metaValues objet
const migrateLegacyMetaToValues = (legacyMeta = {}, metaFields = []) => {
  const out = {};
  metaFields.forEach((f) => {
    if (legacyMeta[f.key] !== undefined) out[f.key] = legacyMeta[f.key];
  });
  // garder ce qu'on peut
  if (out.title === undefined && legacyMeta.title !== undefined)
    out.title = legacyMeta.title;
  if (out.objective === undefined && legacyMeta.objective !== undefined)
    out.objective = legacyMeta.objective;
  if (out.description === undefined && legacyMeta.description !== undefined)
    out.description = legacyMeta.description;
  return out;
};

export default function TeacherDashboard() {
  const [activeTab, setActiveTab] = useState("plans");
  const [plans, setPlans] = useState([]);
  const [formTemplate, setFormTemplate] = useState(null);

  // Valeurs des champs dynamiques "Informations générales"
  const [metaValues, setMetaValues] = useState({});

  const [answers, setAnswers] = useState({});
  const [analysis, setAnalysis] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const currentUser = auth.currentUser;

  // Modèles actifs coordonnateur + sélection (sans auto-sélection)
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  // États d'édition dérivés
  const [planWeeks, setPlanWeeks] = useState([]);
  const [planExams, setPlanExams] = useState([]);

  // Modal de confirmation de modification
  const [showConfirmEdit, setShowConfirmEdit] = useState(false);
  const [planToEdit, setPlanToEdit] = useState(null);

  // Charger les plans du prof (avec fallback sans composite index)
  useEffect(() => {
    if (!(activeTab === "plans" && currentUser)) return;

    const loadPlans = async () => {
      try {
        const q1 = query(
          collection(db, "coursePlans"),
          where("teacherId", "==", currentUser.uid),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q1);
        setPlans(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {"erreur récupération plans", e} {
        const q2 = query(
          collection(db, "coursePlans"),
          where("teacherId", "==", currentUser.uid)
        );
        const snap = await getDocs(q2);
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => {
          const ta = a.createdAt?.toDate
            ? a.createdAt.toDate().getTime()
            : 0;
          const tb = b.createdAt?.toDate
            ? b.createdAt.toDate().getTime()
            : 0;
          return tb - ta;
        });
        setPlans(rows);
      }
    };

    loadPlans();
  }, [activeTab, currentUser]);

  // Charger modèles actifs (coordonnateur)
  useEffect(() => {
    const loadTemplates = async () => {
      const qActifs = query(
        collection(db, "formTemplates"),
        where("active", "==", true)
      );
      const snap = await getDocs(qActifs);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const ta = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const tb = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return tb - ta;
      });
      setTemplates(list);
    };
    if (activeTab === "new") loadTemplates();
  }, [activeTab]);

  // Charger le modèle (sélection ou plan en édition)
  useEffect(() => {
    const loadSelected = async () => {
      // Mode édition: charger le template par formId pour obtenir metaFields/questions
      if (editingPlan?.formId) {
        const tmplRef = doc(db, "formTemplates", editingPlan.formId);
        const tmplSnap = await getDoc(tmplRef);
        if (!tmplSnap.exists()) {
          setFormTemplate(null);
          return;
        }
        const tmplData = { id: tmplSnap.id, ...tmplSnap.data() };
        setFormTemplate(tmplData);

        // Meta values (préférer metaValuesSnapshot, sinon migrer)
        const vals =
          editingPlan.metaValuesSnapshot ||
          migrateLegacyMetaToValues(
            editingPlan.metaSnapshot || {},
            tmplData.metaFields || []
          );
        // Initialiser champs manquants à ""
        const initialMeta = {};
        (tmplData.metaFields || []).forEach((f) => {
          initialMeta[f.key] = vals[f.key] ?? "";
        });
        setMetaValues(initialMeta);

        setPlanWeeks(editingPlan.weeksSnapshot || []);
        setPlanExams(editingPlan.examsSnapshot || []);
        setAnswers(editingPlan.answers || {});
        setAnalysis(null);
        return;
      }

      // Création: aucun modèle sélectionné
      if (!selectedTemplateId) {
        setFormTemplate(null);
        setMetaValues({});
        setPlanWeeks([]);
        setPlanExams([]);
        setAnswers({});
        setAnalysis(null);
        return;
      }

      // Charger le modèle sélectionné
      const docRef = doc(db, "formTemplates", selectedTemplateId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        setFormTemplate(null);
        return;
      }
      const tmpl = { id: snap.id, ...snap.data() };
      setFormTemplate(tmpl);

      // Init metaValues à partir des metaFields
      const initMeta = {};
      (tmpl.metaFields || []).forEach((f) => (initMeta[f.key] = ""));
      setMetaValues(initMeta);

      setPlanWeeks(
        tmpl.weeks?.length
          ? tmpl.weeks
          : [{ id: 1, label: "Semaine 1", learning: "", homework: "" }]
      );
      setPlanExams(tmpl.exams || []);
      const initAns = {};
      (tmpl.questions || []).forEach((q) => (initAns[q.id] = ""));
      setAnswers(initAns);
      setAnalysis(null);
    };

    if (activeTab === "new") loadSelected();
  }, [activeTab, selectedTemplateId, editingPlan]);

  // Sélection modèle
  const handleSelectTemplate = (e) => {
    if (editingPlan) {
      alert("Impossible de changer de modèle en mode édition.");
      return;
    }
    setSelectedTemplateId(e.target.value);
  };

  // Helpers d'édition des meta dynamiques
  const updateMetaValue = (key, value) => {
    setMetaValues((prev) => ({ ...prev, [key]: value }));
  };

  // Helpers Semaines
  const addWeek = () =>
    setPlanWeeks((prev) => [
      ...prev,
      {
        id: (prev[prev.length - 1]?.id || 0) + 1,
        label: `Semaine ${prev.length + 1}`,
        learning: "",
        homework: "",
      },
    ]);

  const updateWeek = (index, field, value) => {
    setPlanWeeks((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const removeWeek = (index) => {
    setPlanWeeks((prev) => {
      const copy = [...prev];
      copy.splice(index, 1);
      return copy.map((w, i) => ({
        ...w,
        id: i + 1,
        label: `Semaine ${i + 1}`,
      }));
    });
  };

  // Helpers Examens
  const addExam = () =>
    setPlanExams((prev) => [
      ...prev,
      {
        id: (prev[prev.length - 1]?.id || 0) + 1,
        title: "",
        date: "",
        coverage: "",
      },
    ]);

  const updateExam = (index, field, value) => {
    setPlanExams((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const removeExam = (index) => {
    setPlanExams((prev) => {
      const copy = [...prev];
      copy.splice(index, 1);
      return copy.map((e, i) => ({ ...e, id: i + 1 }));
    });
  };

  // Réponses
  const handleInputChange = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  // Analyse simple (valide champs requis + réponses min)
  const analyzePlan = () => {
    const suggestions = [];
    let ok = true;

    // Champs requis
    (formTemplate?.metaFields || []).forEach((f) => {
      const v = (metaValues || {})[f.key];
      if (f.required && (!v || !String(v).trim())) {
        ok = false;
        suggestions.push(`Le champ requis "${f.label}" est vide.`);
      }
    });

    // Exemples de règles simples
    const titleVal = getTitleFromMeta(
      formTemplate?.metaFields,
      metaValues
    );
    if (!titleVal || titleVal.length < 3) {
      ok = false;
      suggestions.push("Le titre est trop court.");
    }

    // Réponses aux questions du modèle
    (formTemplate?.questions || []).forEach((q) => {
      const v = (answers[q.id] || "").trim();
      if (v.length < 10) {
        ok = false;
        suggestions.push(
          `Réponse trop courte: ${q.label || "Question"}`
        );
      }
    });

    setAnalysis({
      status: ok ? "Conforme" : "Non conforme",
      suggestions: ok ? ["Le plan semble conforme."] : suggestions,
    });
  };

  // Soumettre / mettre à jour le plan
  const handleSubmitPlan = async () => {
    if (!analysis) {
      alert("Veuillez analyser le plan avec l'IA avant de soumettre.");
      return;
    }
    if (!currentUser) {
      alert("Utilisateur non connecté.");
      return;
    }
    setSubmitting(true);

    // Générer PDF
    const docPDF = new jsPDF();
    let y = 10;

    const titleVal =
      getTitleFromMeta(formTemplate?.metaFields, metaValues) ||
      "Plan de cours";
    docPDF.setFontSize(18);
    docPDF.text(titleVal, 10, y);
    y += 10;

    // Informations générales dynamiques
    docPDF.setFontSize(12);
    docPDF.setFont("helvetica", "bold");
    docPDF.text("Informations générales:", 10, y);
    y += 6;
    docPDF.setFont("helvetica", "normal");
    (formTemplate?.metaFields || []).forEach((f) => {
      const label = f.label || f.key;
      const val = (metaValues || {})[f.key] || "";
      const lines = docPDF.splitTextToSize(`${label}: ${val}`, 180);
      docPDF.text(lines, 10, y);
      y += lines.length * 6 + 2;
      if (y > 270) {
        docPDF.addPage();
        y = 10;
      }
    });
    y += 2;

    // Semaines
    docPDF.setFont("helvetica", "bold");
    docPDF.text("Semaines:", 10, y);
    y += 6;
    planWeeks.forEach((w) => {
      docPDF.setFont("helvetica", "bold");
      docPDF.text(`${w.label}`, 10, y);
      y += 6;
      docPDF.setFont("helvetica", "normal");
      const learn = docPDF.splitTextToSize(
        `Apprentissage: ${w.learning || ""}`,
        180
      );
      const hw = docPDF.splitTextToSize(
        `Devoirs: ${w.homework || ""}`,
        180
      );
      docPDF.text(learn, 10, y);
      y += learn.length * 6;
      docPDF.text(hw, 10, y);
      y += hw.length * 6 + 4;
      if (y > 270) {
        docPDF.addPage();
        y = 10;
      }
    });

    // Évaluations
    docPDF.setFont("helvetica", "bold");
    docPDF.text("Évaluations:", 10, y);
    y += 6;
    planExams.forEach((ex, idx) => {
      const lines = docPDF.splitTextToSize(
        `#${idx + 1} ${ex.title || ""} • Date: ${
          ex.date || "N/D"
        } • Matière: ${ex.coverage || ""}`,
        180
      );
      docPDF.text(lines, 10, y);
      y += lines.length * 6 + 4;
      if (y > 270) {
        docPDF.addPage();
        y = 10;
      }
    });

    // Questions: seulement celles du modèle
    docPDF.setFont("helvetica", "bold");
    docPDF.text("Questions du plan:", 10, y);
    y += 6;
    const modelQuestions = formTemplate?.questions || [];
    modelQuestions.forEach((q, i) => {
      docPDF.setFont("helvetica", "bold");
      docPDF.text(`${i + 1}. ${q.label}`, 10, y);
      y += 6;
      docPDF.setFont("helvetica", "normal");
      const ans = docPDF.splitTextToSize(answers[q.id] || "", 180);
      docPDF.text(ans, 10, y);
      y += ans.length * 6 + 4;
      if (y > 270) {
        docPDF.addPage();
        y = 10;
      }
    });

    // Upload PDF
    const blob = docPDF.output("blob");
    const refStor = ref(
      storage,
      `plans/${currentUser.uid}/${Date.now()}.pdf`
    );
    await uploadBytes(refStor, blob);
    const pdfUrl = await getDownloadURL(refStor);

    const finalTitle = titleVal || "Sans titre";
    const newStatus = editingPlan ? "En révision" : "Soumis";

    const data = {
      teacherId: currentUser.uid,
      createdAt: editingPlan?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
      formId: formTemplate?.id,
      // Snapshots
      metaValuesSnapshot: { ...metaValues }, // valeurs dynamiques
      weeksSnapshot: [...planWeeks],
      examsSnapshot: [...planExams],
      questionsSnapshot: modelQuestions, // seulement les questions du modèle
      aiRulesSnapshot: formTemplate?.aiRules || [],
      title: finalTitle,
      answers,
      status: newStatus,
      pdfUrl,
    };

    if (editingPlan) {
      await setDoc(doc(db, "coursePlans", editingPlan.id), data, {
        merge: true,
      });
    } else {
      await addDoc(collection(db, "coursePlans"), data);
    }

    alert("Sauvegardé !");
    setSubmitting(false);
    setAnswers({});
    setAnalysis(null);
    setEditingPlan(null);
    setSelectedTemplateId("");
    setFormTemplate(null);
    setMetaValues({});
    setPlanWeeks([]);
    setPlanExams([]);
    setActiveTab("plans");
  };

  // Titre pour la liste des plans (fallback rétrocompatible)
  const titleForPlanList = (p) =>
    p.metaValuesSnapshot?.title ||
    p.metaSnapshot?.title ||
    p.title ||
    "Sans titre";

  return (
    <div className="flex h-screen bg-dark-bg text-dark-text overflow-hidden relative">
      <div className="flex-1 flex flex-col">
        <Navbar />
        <div className="flex flex-1 overflow-hidden">
          <SidebarTeacher activeTab={activeTab} setActiveTab={setActiveTab} />
          <main className="flex-1 overflow-y-auto p-8">
            {/* MES PLANS */}
            {activeTab === "plans" && (
              <div className="card-modern">
                <h2 className="text-2xl font-bold text-white mb-4">
                  Mes plans
                </h2>
                {plans.length === 0 ? (
                  <p className="text-slate-400">Aucun plan.</p>
                ) : (
                  <div className="space-y-4">
                    {plans.map((p) => (
                      <div
                        key={p.id}
                        className="p-4 rounded-lg border border-dark-border bg-dark-bg/50"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-white mb-1">
                              {titleForPlanList(p)}
                            </h3>
                            <div className="flex items-center gap-3 text-sm text-slate-400">
                              <span
                                className={`px-2 py-1 rounded font-semibold ${
                                  p.status === "Approuvé"
                                    ? "bg-green-900/30 text-green-300"
                                    : p.status === "En révision"
                                    ? "bg-yellow-900/30 text-yellow-300"
                                    : "bg-blue-900/30 text-blue-300"
                                }`}
                              >
                                {p.status || "N/A"}
                              </span>
                              <span>Créé: {formatDateTime(p.createdAt)}</span>
                            </div>
                          </div>
                          {p.status !== "Approuvé" && (
                            <button
                              className="px-3 py-1 text-sm rounded bg-blue-600 hover:bg-blue-500 ml-4"
                              onClick={() => {
                                setPlanToEdit(p);
                                setShowConfirmEdit(true);
                              }}
                            >
                              Modifier
                            </button>
                          )}
                        </div>
                        
                        {p.coordinatorComment && p.status !== "Approuvé" && (
                          <div className="mt-3 p-3 bg-slate-900/50 rounded border border-slate-700">
                            <p className="text-xs text-slate-400 font-semibold mb-1">
                              Commentaire du coordonnateur:
                            </p>
                            <p className="text-slate-300 text-sm">
                              {p.coordinatorComment}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* NOUVEAU / MODIFIER PLAN */}
            {activeTab === "new" && (
              <div className="max-w-4xl mx-auto card-modern">
                <h2 className="text-2xl font-bold text-white mb-6 border-b border-dark-border pb-4">
                  {editingPlan
                    ? "Modifier mon plan de cours"
                    : "Nouveau plan de cours"}
                </h2>

                {/* Sélecteur de modèle actif */}
                {!editingPlan && (
                  <div className="mb-6">
                    <label className="block text-sm text-slate-300 mb-2">
                      Choisir un modèle du coordonnateur
                    </label>
                    {templates.length === 0 ? (
                      <div className="text-sm text-red-300 bg-red-900/20 rounded p-3">
                        Aucun modèle actif trouvé. Demandez au coordonnateur
                        d’en créer/activer un.
                      </div>
                    ) : (
                      <select
                        value={selectedTemplateId}
                        onChange={handleSelectTemplate}
                        className="input-modern"
                      >
                        <option value="">
                          — Sélectionner un modèle —
                        </option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.templateName ||
                              t.meta?.title ||
                              "Sans titre"}{" "}
                            • {(t.questions || []).length} questions
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {!formTemplate ? (
                  <p className="text-slate-400">
                    Sélectionnez un modèle pour commencer.
                  </p>
                ) : (
                  <form
                    onSubmit={(e) => e.preventDefault()}
                    className="space-y-6"
                  >
                    {/* 1. Informations générales (dynamiques) */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-white">
                        1. Informations générales
                      </h3>
                      {(formTemplate.metaFields || []).length === 0 && (
                        <p className="text-slate-400 text-sm">
                          Aucun champ défini par le coordonnateur.
                        </p>
                      )}
                      {(formTemplate.metaFields || []).map((f) => (
                        <div key={f.id}>
                          <label className="block text-sm text-slate-300 mb-1">
                            {f.label || f.key}{" "}
                            {f.required ? (
                              <span className="text-red-400">*</span>
                            ) : null}
                          </label>
                          {f.type === "textarea" ? (
                            <textarea
                              className="input-modern min-h-[80px]"
                              placeholder={f.placeholder || ""}
                              value={metaValues[f.key] || ""}
                              onChange={(e) =>
                                updateMetaValue(f.key, e.target.value)
                              }
                            />
                          ) : (
                            <input
                              className="input-modern"
                              placeholder={f.placeholder || ""}
                              value={metaValues[f.key] || ""}
                              onChange={(e) =>
                                updateMetaValue(f.key, e.target.value)
                              }
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* 2. Planification hebdomadaire */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold text-white">
                          2. Planification hebdomadaire
                        </h3>
                        <button
                          type="button"
                          onClick={addWeek}
                          className="px-2 py-1 text-sm bg-dark-bg border border-dark-border rounded"
                        >
                          + Semaine
                        </button>
                      </div>
                      <div className="space-y-3">
                        {planWeeks.map((w, i) => (
                          <div
                            key={w.id}
                            className="p-3 rounded border border-dark-border"
                          >
                            <div className="flex justify-between items-center mb-2">
                              <strong>{w.label}</strong>
                              <button
                                type="button"
                                onClick={() => removeWeek(i)}
                                className="text-red-400 text-sm"
                              >
                                Supprimer
                              </button>
                            </div>
                            <textarea
                              className="input-modern min-h-[60px]"
                              placeholder="Ce qui sera appris..."
                              value={w.learning}
                              onChange={(e) =>
                                updateWeek(i, "learning", e.target.value)
                              }
                            />
                            <textarea
                              className="input-modern min-h-[60px] mt-2"
                              placeholder="Devoirs..."
                              value={w.homework}
                              onChange={(e) =>
                                updateWeek(i, "homework", e.target.value)
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 3. Évaluations */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold text-white">
                          3. Évaluations
                        </h3>
                        <button
                          type="button"
                          onClick={addExam}
                          className="px-2 py-1 text-sm bg-dark-bg border border-dark-border rounded"
                        >
                          + Évaluation
                        </button>
                      </div>
                      <div className="space-y-3">
                        {planExams.map((ex, i) => (
                          <div
                            key={ex.id}
                            className="p-3 rounded border border-dark-border"
                          >
                            <div className="flex justify-between items-center mb-2">
                              <strong>Évaluation #{i + 1}</strong>
                              <button
                                type="button"
                                onClick={() => removeExam(i)}
                                className="text-red-400 text-sm"
                              >
                                Supprimer
                              </button>
                            </div>
                            <input
                              className="input-modern"
                              placeholder="Titre"
                              value={ex.title}
                              onChange={(e) =>
                                updateExam(i, "title", e.target.value)
                              }
                            />
                            <input
                              className="input-modern mt-2"
                              placeholder="Date (YYYY-MM-DD)"
                              value={ex.date}
                              onChange={(e) =>
                                updateExam(i, "date", e.target.value)
                              }
                            />
                            <textarea
                              className="input-modern min-h-[60px] mt-2"
                              placeholder="Matière couverte"
                              value={ex.coverage}
                              onChange={(e) =>
                                updateExam(i, "coverage", e.target.value)
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 4. Questions du plan (modèle uniquement) */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold text-white">
                          4. Questions du plan (
                          {(formTemplate.questions || []).length})
                        </h3>
                      </div>

                      <p className="text-xs text-slate-400">
                        Les questions sont définies par le coordonnateur. Vous
                        pouvez seulement répondre.
                      </p>

                      {(formTemplate.questions || []).map((q, i) => (
                        <div
                          key={q.id}
                          className="bg-slate-900/50 p-4 rounded-xl border border-slate-700"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <span className="font-bold text-white">
                              Question #{i + 1}
                            </span>
                          </div>

                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs text-slate-400 block mb-1">
                                Intitulé de la question
                              </label>
                              <p className="text-sm text-slate-200">
                                {q.label || "—"}
                              </p>
                            </div>
                            <div>
                              <label className="text-xs text-slate-400 block mb-1">
                                Champ lié (optionnel)
                              </label>
                              <p className="text-sm text-slate-400">
                                {q.field || "—"}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4">
                            <label className="text-xs text-slate-400 block mb-1">
                              Règle de validation IA
                            </label>
                            <p className="text-sm text-slate-300 whitespace-pre-wrap">
                              {q.rule || "—"}
                            </p>
                          </div>

                          <div className="mt-4">
                            <label className="text-xs text-slate-400 block mb-1">
                              Votre réponse
                            </label>
                            <textarea
                              className="input-modern min-h-[100px] text-sm"
                              value={answers[q.id] || ""}
                              onChange={(e) =>
                                handleInputChange(q.id, e.target.value)
                              }
                              placeholder="Votre réponse..."
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 5. Règles principales (lecture seule) */}
                    <div>
                      <h3 className="font-semibold text-white mb-2">
                        5. Règles principales (indépendantes) (
                        {(formTemplate.aiRules || []).length})
                      </h3>
                      {(formTemplate.aiRules || []).length === 0 ? (
                        <p className="text-slate-400 text-sm">
                          Aucune règle définie par le coordonnateur.
                        </p>
                      ) : (
                        <ul className="list-disc pl-5 text-sm text-slate-300">
                          {(formTemplate.aiRules || []).map((r, i) => (
                            <li key={r.id || i}>{r.text || String(r)}</li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button
                        id="analyze-btn"
                        onClick={analyzePlan}
                        className="btn-primary bg-purple-600 hover:bg-purple-500"
                        type="button"
                      >
                        ✨ Analyser
                      </button>
                      <button
                        onClick={handleSubmitPlan}
                        className={`btn-primary flex-1 ${
                          !analysis ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                        title={
                          !analysis
                            ? "Analyse requise avant soumission"
                            : ""
                        }
                        type="button"
                      >
                        {submitting
                          ? "Envoi..."
                          : editingPlan
                          ? "Enregistrer les modifications"
                          : "Soumettre"}
                      </button>
                    </div>

                    {analysis && (
                      <div
                        className={`p-4 rounded-xl border mt-4 ${
                          analysis.status === "Conforme"
                            ? "bg-green-900/20 border-green-500"
                            : "bg-red-900/20 border-red-500"
                        }`}
                      >
                        <h3 className="font-bold mb-2">
                          {analysis.status}
                        </h3>
                        <ul className="list-disc pl-5 text-sm text-slate-300">
                          {analysis.suggestions.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </form>
                )}
              </div>
            )}

            {activeTab === "submits" && <TeacherSubmits />}
            {activeTab === "settings" && <TeacherSettings />}
          </main>
        </div>
      </div>

      {/* MODAL CONFIRMATION MODIFICATION */}
      {showConfirmEdit && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-dark-bg border border-dark-border p-6 rounded-xl max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">
              Modifier ce plan ?
            </h2>
            <p className="text-slate-300 mb-6">
              Modifier ce plan va{" "}
              <strong>écraser l'ancienne version</strong> et renvoyer
              une <strong>nouvelle demande d’approbation</strong> au
              coordonnateur.
            </p>

            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 bg-slate-700 rounded hover:bg-slate-600"
                onClick={() => {
                  setShowConfirmEdit(false);
                  setPlanToEdit(null);
                }}
              >
                Annuler
              </button>
              <button
                className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500"
                onClick={() => {
                  setEditingPlan(planToEdit);
                  setSelectedTemplateId(planToEdit.formId || "");
                  setShowConfirmEdit(false);
                  setActiveTab("new");
                }}
              >
                Modifier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
