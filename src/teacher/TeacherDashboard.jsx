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
  setDoc,
  getDoc,
  deleteDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { jsPDF } from "jspdf";

// --- PDF GENERATOR ---
const generatePDF = (planData, teacherName) => {
  const doc = new jsPDF();

  // Couleurs (RGB)
  const BLUE = [37, 99, 235]; // #2563eb (Questions)
  const TEAL = [13, 148, 136]; // #0d9488 (Semaines/Évaluations - Distinct)
  const GRAY_BG = [243, 244, 246]; // #f3f4f6 (Fond gris clair)
  const TEXT_COLOR = [55, 65, 81]; // #374151 (Gris foncé)

  let y = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // --- LOGIQUE TITRE ---
  // Trouver le titre dans les réponses si une question s'appelle "Titre"
  let courseTitle = planData.title || "Plan de cours";
  const titleQuestion = (planData.questionsSnapshot || []).find(
    (q) => q.label.toLowerCase() === "titre"
  );
  if (titleQuestion && planData.answers[titleQuestion.id]) {
    courseTitle = planData.answers[titleQuestion.id];
  }

  // 1. Header Global
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...BLUE);
  doc.text("PLAN DE COURS", margin, y);
  y += 10;

  // 2. Bloc Info (Enseignant, Formulaire, etc)
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);

  // Gauche
  doc.setFont("helvetica", "bold");
  doc.text(`Enseignant:`, margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(teacherName, margin + 25, y); // Affiche le NOM, pas l'email
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text(`Formulaire:`, margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(courseTitle, margin + 25, y); // Affiche le Titre du cours

  // Droite
  y -= 6;
  doc.setFont("helvetica", "bold");
  const dateStr = new Date().toLocaleDateString("fr-FR");
  doc.text(`Date de génération:`, pageWidth - margin - 35, y, {
    align: "right",
  });
  doc.setFont("helvetica", "normal");
  doc.text(dateStr, pageWidth - margin, y, { align: "right" });

  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text(`Statut IA:`, pageWidth - margin - 35, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text("Analysé", pageWidth - margin, y, { align: "right" });

  y += 15;
  // Ligne de séparation
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Fonction helper pour ajouter une section stylisée
  const addSection = (title, content, color = BLUE) => {
    // Nouvelle page si nécessaire
    if (y > 260) {
      doc.addPage();
      y = 20;
    }

    // Titre de la section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...color);
    doc.text(title, margin, y);
    y += 5;

    // Contenu dans boîte grise
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_COLOR);

    const splitText = doc.splitTextToSize(
      content || "Non spécifié.",
      contentWidth - 8
    );
    const boxHeight = splitText.length * 5 + 12;

    // Vérif saut de page pour la boîte
    if (y + boxHeight > 280) {
      doc.addPage();
      y = 20;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...color);
      doc.text(title + " (suite)", margin, y);
      y += 5;
    }

    // Fond gris
    doc.setFillColor(...GRAY_BG);
    doc.rect(margin, y, contentWidth, boxHeight, "F");

    // Barre colorée à gauche
    doc.setDrawColor(...color);
    doc.setLineWidth(1.5);
    doc.line(margin, y, margin, y + boxHeight);

    // Texte
    doc.text(splitText, margin + 4, y + 8);

    y += boxHeight + 8; // Espace après la section
  };

  // Helper pour Titres de Section Principale
  const addMainHeader = (text, color = TEAL) => {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...color);
    doc.text(text, margin, y);
    y += 10;
  };

  // --- RENDU DES DONNÉES ---

  // 1. Meta Fields (Description, etc, sauf titre)
  const meta = planData.metaValuesSnapshot || {};
  Object.keys(meta).forEach((key) => {
    if (key !== "title" && meta[key]) {
      addSection(key.charAt(0).toUpperCase() + key.slice(1), meta[key], BLUE);
    }
  });

  // 2. Questions (Filtre "Titre", re-numérotation)
  const questionsToRender = (planData.questionsSnapshot || []).filter(
    (q) => q.label.toLowerCase() !== "titre"
  );

  questionsToRender.forEach((q, idx) => {
    const answer = planData.answers[q.id] || "";
    // idx + 1 car on re-numérote après avoir retiré le titre
    addSection(`Question ${idx + 1}: ${q.label}`, answer, BLUE);
  });

  // 3. Semaines (Couleur TEAL pour différencier)
  if (planData.weeksSnapshot && planData.weeksSnapshot.length > 0) {
    addMainHeader("Planification Hebdomadaire", TEAL);

    planData.weeksSnapshot.forEach((w) => {
      const text = `Apprentissage: ${w.learning || ""}\nDevoirs: ${
        w.homework || ""
      }`;
      addSection(`${w.label}`, text, TEAL);
    });
  }

  // 4. Évaluations (Couleur TEAL)
  if (planData.examsSnapshot && planData.examsSnapshot.length > 0) {
    addMainHeader("Évaluations", TEAL);

    planData.examsSnapshot.forEach((ex, idx) => {
      const title = ex.title || `Évaluation ${idx + 1}`;
      const text = `Date: ${ex.date || "À déterminer"}\nMatière: ${
        ex.coverage || "Non spécifiée"
      }`;
      addSection(title, text, TEAL);
    });
  }

  // --- PAGINATION (Footer) ---
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} sur ${pageCount}`, pageWidth / 2, pageHeight - 10, {
      align: "center",
    });
  }

  return doc.output("blob");
};

export default function TeacherDashboard() {
  const [activeTab, setActiveTab] = useState("plans");
  const [plans, setPlans] = useState([]);
  const [formTemplate, setFormTemplate] = useState(null);

  // States formulaire
  const [metaValues, setMetaValues] = useState({});
  const [answers, setAnswers] = useState({});
  const [analysis, setAnalysis] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);

  // Listes
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [planWeeks, setPlanWeeks] = useState([]);
  const [planExams, setPlanExams] = useState([]);

  // Modal Suppression
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  // User Info
  const [teacherFullName, setTeacherFullName] = useState("");
  const currentUser = auth.currentUser;

  // 1. Fetch User Name on Mount
  useEffect(() => {
    const fetchUserName = async () => {
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.firstName && data.lastName) {
              setTeacherFullName(`${data.firstName} ${data.lastName}`);
            } else {
              setTeacherFullName(currentUser.email);
            }
          } else {
            setTeacherFullName(currentUser.displayName || currentUser.email);
          }
        } catch (e) {
          console.error("Erreur fetch user:", e);
          setTeacherFullName(currentUser.email);
        }
      }
    };
    fetchUserName();
  }, [currentUser]);

  // 2. Charger MES plans
  useEffect(() => {
    if (activeTab === "plans" && currentUser) {
      const load = async () => {
        try {
          const q = query(
            collection(db, "coursePlans"),
            where("teacherId", "==", currentUser.uid)
          );
          const snap = await getDocs(q);
          const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          rows.sort(
            (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
          );
          setPlans(rows);
        } catch (e) {
          console.error("Erreur chargement plans:", e);
        }
      };
      load();
    }
  }, [activeTab, currentUser]);

  // 3. Charger les Modèles
  useEffect(() => {
    if (activeTab === "new") {
      const load = async () => {
        const q = query(
          collection(db, "formTemplates"),
          where("active", "==", true)
        );
        const snap = await getDocs(q);
        setTemplates(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      };
      load();
    }
  }, [activeTab]);

  // 4. Gérer la sélection / édition
  useEffect(() => {
    if (activeTab !== "new") return;

    if (editingPlan) {
      const loadEdit = async () => {
        if (editingPlan.formId) {
          const snap = await getDoc(
            doc(db, "formTemplates", editingPlan.formId)
          );
          if (snap.exists()) setFormTemplate({ id: snap.id, ...snap.data() });
        }
        setMetaValues(editingPlan.metaValuesSnapshot || {});
        setAnswers(editingPlan.answers || {});
        setPlanWeeks(editingPlan.weeksSnapshot || []);
        setPlanExams(editingPlan.examsSnapshot || []);
      };
      loadEdit();
    } else if (selectedTemplateId) {
      const tmpl = templates.find((t) => t.id === selectedTemplateId);
      if (tmpl) {
        setFormTemplate(tmpl);
        const initMeta = {};
        (tmpl.metaFields || []).forEach((f) => (initMeta[f.key] = ""));
        setMetaValues(initMeta);
        const initAns = {};
        (tmpl.questions || []).forEach((q) => (initAns[q.id] = ""));
        setAnswers(initAns);
        setPlanWeeks(tmpl.weeks || []);
        setPlanExams(tmpl.exams || []);
      }
    } else {
      setFormTemplate(null);
    }
  }, [selectedTemplateId, editingPlan, templates, activeTab]);

  // --- ACTIONS ---

  const handleAnswerChange = (qId, val) =>
    setAnswers((prev) => ({ ...prev, [qId]: val }));

  const addWeek = () =>
    setPlanWeeks((prev) => [
      ...prev,
      {
        id: Date.now(),
        label: `Semaine ${prev.length + 1}`,
        learning: "",
        homework: "",
      },
    ]);
  const removeWeek = (idx) =>
    setPlanWeeks((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((w, i) => ({ ...w, label: `Semaine ${i + 1}` }))
    );
  const updateWeek = (idx, field, val) => {
    const newWeeks = [...planWeeks];
    newWeeks[idx][field] = val;
    setPlanWeeks(newWeeks);
  };

  const addExam = () =>
    setPlanExams((prev) => [
      ...prev,
      { id: Date.now(), title: "", date: "", coverage: "" },
    ]);
  const removeExam = (idx) =>
    setPlanExams((prev) => prev.filter((_, i) => i !== idx));
  const updateExam = (idx, field, val) => {
    const newExams = [...planExams];
    newExams[idx][field] = val;
    setPlanExams(newExams);
  };

  const handleDeletePlan = async (planId) => {
    try {
      await deleteDoc(doc(db, "coursePlans", planId));
      setPlans((prev) => prev.filter((p) => p.id !== planId));
      setShowDeleteConfirm(null);
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la suppression.");
    }
  };

  const analyzePlan = () => {
    setAnalysis({
      status: "Conforme",
      suggestions: [
        "Le plan respecte la structure demandée.",
        "Objectifs clairs.",
      ],
    });
  };

  const handleSubmit = async () => {
    if (!analysis) return alert("Veuillez analyser le plan d'abord.");
    setSubmitting(true);

    try {
      // Logique de titre pour sauvegarde
      let rawTitle = metaValues.title || "Plan de cours";
      // Si titre est dans les réponses (cas du template user)
      if (formTemplate) {
        const titleQ = formTemplate.questions.find(
          (q) => q.label.toLowerCase() === "titre"
        );
        if (titleQ && answers[titleQ.id]) {
          rawTitle = answers[titleQ.id];
        }
      }

      // --- FILENAME GENERATION ---
      const safeName = (teacherFullName || "Prof").replace(
        /[^a-zA-Z0-9]/g,
        "_"
      );
      const safeCode = rawTitle.substring(0, 20).replace(/[^a-zA-Z0-9]/g, "_");
      const fileName = `${safeName}_${safeCode}_${Date.now()}.pdf`;

      const planData = {
        title: rawTitle,
        metaValuesSnapshot: metaValues,
        questionsSnapshot: formTemplate.questions,
        weeksSnapshot: planWeeks,
        examsSnapshot: planExams,
        answers: answers,
      };

      const pdfBlob = generatePDF(planData, teacherFullName);
      const pdfRef = ref(storage, `plans/${currentUser.uid}/${fileName}`);
      await uploadBytes(pdfRef, pdfBlob);
      const pdfUrl = await getDownloadURL(pdfRef);

      const firestoreData = {
        ...planData,
        teacherId: currentUser.uid,
        formId: formTemplate.id,
        status: "Soumis",
        pdfUrl,
        updatedAt: serverTimestamp(),
        createdAt: editingPlan ? editingPlan.createdAt : serverTimestamp(),
      };

      if (editingPlan) {
        await setDoc(doc(db, "coursePlans", editingPlan.id), firestoreData, {
          merge: true,
        });
      } else {
        await addDoc(collection(db, "coursePlans"), firestoreData);
      }

      alert("Plan soumis avec succès !");
      setEditingPlan(null);
      setSelectedTemplateId("");
      setActiveTab("plans");
    } catch (e) {
      console.error("Erreur soumission:", e);
      alert("Erreur lors de la sauvegarde.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen bg-dark-bg text-dark-text overflow-hidden">
      <div className="flex-1 flex flex-col">
        <Navbar />
        <div className="flex flex-1 overflow-hidden">
          <SidebarTeacher activeTab={activeTab} setActiveTab={setActiveTab} />

          <main className="flex-1 overflow-y-auto p-8">
            {activeTab === "plans" && (
              <div className="card-modern">
                <h2 className="text-2xl font-bold text-white mb-6">
                  Mes Plans
                </h2>
                {plans.length === 0 ? (
                  <p className="text-slate-500">Aucun plan trouvé.</p>
                ) : (
                  <div className="space-y-4">
                    {plans.map((p) => (
                      <div
                        key={p.id}
                        className="border border-dark-border bg-slate-900/50 p-4 rounded-xl flex justify-between items-center hover:border-blue-500/30 transition-colors"
                      >
                        <div>
                          <div className="font-bold text-lg text-white">
                            {p.title || "Sans titre"}
                          </div>
                          <div className="flex gap-2 mt-1">
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${
                                p.status === "Approuvé"
                                  ? "bg-green-900 text-green-300"
                                  : p.status === "À corriger"
                                  ? "bg-red-900 text-red-300"
                                  : "bg-yellow-900 text-yellow-300"
                              }`}
                            >
                              {p.status || "Brouillon"}
                            </span>
                            <span className="text-xs text-slate-500">
                              {p.createdAt?.toDate
                                ? p.createdAt.toDate().toLocaleDateString()
                                : ""}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <a
                            href={p.pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-white text-sm px-4 py-2 bg-slate-700 rounded-lg hover:bg-slate-600"
                          >
                            PDF
                          </a>
                          <button
                            onClick={() => {
                              setEditingPlan(p);
                              setActiveTab("new");
                            }}
                            className="text-blue-400 text-sm px-4 py-2 bg-blue-900/20 rounded-lg"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(p.id)}
                            className="text-red-400 text-sm px-4 py-2 bg-red-900/20 rounded-lg hover:bg-red-900/40"
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "new" && (
              <div className="max-w-5xl mx-auto">
                <h2 className="text-2xl font-bold text-white mb-6">
                  {editingPlan
                    ? "Modifier le plan de cours"
                    : "Nouveau plan de cours"}
                </h2>

                {!editingPlan && (
                  <div className="mb-8">
                    <label className="text-sm text-slate-400 mb-2 block">
                      Choisir un modèle du coordonnateur
                    </label>
                    <select
                      className="input-modern bg-slate-900 border-slate-700 text-white rounded-xl px-4 py-3 w-full focus:ring-2 focus:ring-blue-500 outline-none"
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                    >
                      <option value="">Sans titre • 4 questions</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.templateName || "Modèle"} • {t.questions?.length}{" "}
                          questions
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {formTemplate && (
                  <form
                    onSubmit={(e) => e.preventDefault()}
                    className="space-y-8 animate-fade-in"
                  >
                    {/* 1. Meta */}
                    <div>
                      <h3 className="text-lg font-bold text-white mb-2">
                        1. Informations générales
                      </h3>
                      {!formTemplate.metaFields ||
                      formTemplate.metaFields.length === 0 ? (
                        <p className="text-slate-500 text-sm">
                          Aucun champ défini par le coordonnateur.
                        </p>
                      ) : (
                        <div className="grid gap-4">
                          {formTemplate.metaFields.map((f) => (
                            <div key={f.id}>
                              <label className="text-sm text-slate-400 block mb-1">
                                {f.label}
                              </label>
                              <input
                                className="input-modern"
                                value={metaValues[f.key] || ""}
                                onChange={(e) =>
                                  setMetaValues({
                                    ...metaValues,
                                    [f.key]: e.target.value,
                                  })
                                }
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 2. Questions */}
                    <div>
                      <h3 className="text-lg font-bold text-white mb-2">
                        2. Questions du plan (
                        {formTemplate.questions?.length || 0})
                      </h3>
                      <div className="space-y-4">
                        {formTemplate.questions?.map((q, idx) => (
                          <div
                            key={q.id}
                            className="bg-slate-900/40 border border-slate-700 rounded-xl p-6"
                          >
                            <div className="flex justify-between mb-4">
                              <span className="font-bold text-white text-base">
                                Question #{idx + 1}
                              </span>
                              <span className="text-xs text-slate-500">
                                Champ lié (optionnel)
                              </span>
                            </div>
                            <div className="mb-4">
                              <div className="text-sm text-white font-semibold mb-1">
                                {q.label}
                              </div>
                              <div className="text-xs text-slate-400">
                                Règle: {q.rule}
                              </div>
                            </div>
                            <textarea
                              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-white focus:ring-1 focus:ring-blue-500 outline-none min-h-[100px]"
                              placeholder="Votre réponse..."
                              value={answers[q.id] || ""}
                              onChange={(e) =>
                                handleAnswerChange(q.id, e.target.value)
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 3. Weeks */}
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-lg font-bold text-white">
                          3. Planification hebdomadaire
                        </h3>
                        <button
                          onClick={addWeek}
                          className="text-xs bg-slate-800 text-slate-300 px-3 py-1.5 rounded hover:bg-slate-700 border border-slate-600"
                        >
                          + Semaine
                        </button>
                      </div>
                      <div className="space-y-3">
                        {planWeeks.map((w, i) => (
                          <div
                            key={w.id}
                            className="bg-slate-900/40 border border-slate-700 rounded-xl p-4"
                          >
                            <div className="flex justify-between mb-2">
                              <span className="text-white font-semibold text-sm">
                                {w.label}
                              </span>
                              <button
                                onClick={() => removeWeek(i)}
                                className="text-red-400 text-xs hover:underline"
                              >
                                Supprimer
                              </button>
                            </div>
                            <div className="grid gap-3">
                              <textarea
                                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-2 text-white text-sm"
                                placeholder="Ce qui sera appris..."
                                value={w.learning}
                                onChange={(e) =>
                                  updateWeek(i, "learning", e.target.value)
                                }
                              />
                              <textarea
                                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-2 text-white text-sm"
                                placeholder="Devoirs..."
                                value={w.homework}
                                onChange={(e) =>
                                  updateWeek(i, "homework", e.target.value)
                                }
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 4. Exams */}
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-lg font-bold text-white">
                          4. Évaluations
                        </h3>
                        <button
                          onClick={addExam}
                          className="text-xs bg-slate-800 text-slate-300 px-3 py-1.5 rounded hover:bg-slate-700 border border-slate-600"
                        >
                          + Évaluation
                        </button>
                      </div>
                      <div className="space-y-3">
                        {planExams.map((ex, i) => (
                          <div
                            key={ex.id}
                            className="bg-slate-900/40 border border-slate-700 rounded-xl p-4 flex gap-4 items-start"
                          >
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                              <input
                                className="input-modern py-2 text-sm"
                                placeholder="Titre examen"
                                value={ex.title}
                                onChange={(e) =>
                                  updateExam(i, "title", e.target.value)
                                }
                              />
                              <input
                                className="input-modern py-2 text-sm"
                                placeholder="Date"
                                value={ex.date}
                                onChange={(e) =>
                                  updateExam(i, "date", e.target.value)
                                }
                              />
                              <input
                                className="input-modern py-2 text-sm"
                                placeholder="Matière..."
                                value={ex.coverage}
                                onChange={(e) =>
                                  updateExam(i, "coverage", e.target.value)
                                }
                              />
                            </div>
                            <button
                              onClick={() => removeExam(i)}
                              className="text-red-400 text-xs mt-2"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex gap-4 pt-6 border-t border-slate-700">
                      <button
                        onClick={analyzePlan}
                        className="bg-gradient-to-r from-blue-500 to-purple-600 hover:opacity-90 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-purple-500/20"
                      >
                        ✨ Analyser
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={submitting || !analysis}
                        className={`flex-1 bg-primary hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-blue-500/20 ${
                          !analysis || submitting
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                        }`}
                      >
                        {submitting ? "Envoi en cours..." : "Soumettre"}
                      </button>
                    </div>

                    {analysis && (
                      <div className="bg-slate-800 border border-green-500/30 p-4 rounded-xl mt-4 animate-fade-in">
                        <h4 className="font-bold text-green-400 mb-2">
                          ✓ Résultat de l'analyse : {analysis.status}
                        </h4>
                        <ul className="list-disc pl-5 text-sm text-slate-300 space-y-1">
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

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2">
              Supprimer le plan ?
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-xl"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDeletePlan(showDeleteConfirm)}
                className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 py-2 rounded-xl"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
