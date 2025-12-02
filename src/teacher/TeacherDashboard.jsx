// src/teacher/TeacherDashboard.jsx
import SidebarTeacher from "./SidebarTeacher";
import TeacherSettings from "./TeacherSettings";
import TeacherSubmits from "./TeacherSubmits"; // Onglet Remises
import Navbar from "../components/Navbar";
import React, { useEffect, useState } from "react";
import { analyzeAnswerWithAI } from "../services/openaiService";
import { auth, db, storage } from "../firebase";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  deleteDoc,
  doc,
  orderBy,
  limit,
  setDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { jsPDF } from "jspdf";

// Format date + heure
const formatDateTime = (ts) => {
  if (!ts) return "N/A";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function TeacherDashboard() {
  const [activeTab, setActiveTab] = useState("new");
  const [plans, setPlans] = useState([]);
  const [formTemplate, setFormTemplate] = useState(null);
  const [answers, setAnswers] = useState({});
  const [analysis, setAnalysis] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const currentUser = auth.currentUser;

  // Charger les plans du prof
  useEffect(() => {
    if (activeTab === "plans" && currentUser) {
      const q = query(
        collection(db, "coursePlans"),
        where("teacherId", "==", currentUser.uid),
        orderBy("createdAt", "desc")
      );
      getDocs(q).then((snap) =>
        setPlans(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      );
    }
  }, [activeTab, currentUser]);

  // Charger le formulaire
  useEffect(() => {
    const loadForm = async () => {
      if (editingPlan) {
        setFormTemplate({
          id: editingPlan.formId,
          questions: editingPlan.questionsSnapshot,
        });
        return;
      }
      const q = query(
        collection(db, "formTemplates"),
        orderBy("createdAt", "desc"),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setFormTemplate({ id: snap.docs[0].id, ...data });
        const init = {};
        data.questions?.forEach((q) => (init[q.id] = ""));
        if (!editingPlan) setAnswers(init);
      }
    };
    if (activeTab === "new") loadForm();
  }, [activeTab, editingPlan]);

  const handleInputChange = (id, val) =>
    setAnswers((p) => ({ ...p, [id]: val }));

  const analyzePlan = async () => {
    if (!formTemplate) return;
    const btn = document.getElementById("analyze-btn");
    if (btn) btn.innerText = "Analyse...";
    let status = "Conforme",
      suggestions = [];
    for (const q of formTemplate.questions) {
      const res = await analyzeAnswerWithAI(
        q.label,
        q.rule,
        answers[q.id] || ""
      );
      if (res.status === "Non conforme") status = "Non conforme";
      res.feedback?.forEach((f) => suggestions.push(`[${q.label}] : ${f}`));
    }
    setAnalysis({ status, suggestions });
    if (btn) btn.innerText = "Analyser (IA)";
  };

  const handleSubmitPlan = async () => {
    if (!analysis) {
      alert("Veuillez analyser le plan avec l'IA avant de soumettre.");
      return;
    }

    setSubmitting(true);

    // Création PDF
    const docPDF = new jsPDF();
    docPDF.text("PLAN DE COURS", 10, 10);
    formTemplate.questions.forEach((q, i) => {
      docPDF.text(
        `${i + 1}. ${q.label}: ${answers[q.id] || ""}`,
        10,
        20 + i * 10
      );
    });
    const blob = docPDF.output("blob");
    const refStor = ref(storage, `plans/${currentUser.uid}/${Date.now()}.pdf`);
    await uploadBytes(refStor, blob);
    const pdfUrl = await getDownloadURL(refStor);

    const titleQ =
      formTemplate.questions.find((q) =>
        q.label.toLowerCase().includes("titre")
      ) || formTemplate.questions[0];
    const finalTitle = answers[titleQ.id] || "Sans titre";

    const data = {
      teacherId: currentUser.uid,
      createdAt: editingPlan?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
      formId: formTemplate.id,
      questionsSnapshot: formTemplate.questions,
      title: finalTitle,
      answers,
      status: editingPlan?.status === "Approuvé" ? "En révision" : "Soumis",
      pdfUrl,
    };

    if (editingPlan)
      await setDoc(doc(db, "coursePlans", editingPlan.id), data, { merge: true });
    else await addDoc(collection(db, "coursePlans"), data);

    alert("Sauvegardé !");
    setSubmitting(false);
    setAnswers({});
    setAnalysis(null);
    setEditingPlan(null);
    setActiveTab("plans");
  };

  return (
    <div className="flex h-screen bg-dark-bg text-dark-text overflow-hidden">
      <div className="flex-1 flex flex-col">
        <Navbar />
        <div className="flex flex-1 overflow-hidden">
          <SidebarTeacher activeTab={activeTab} setActiveTab={setActiveTab} />
          <main className="flex-1 overflow-y-auto p-8">
            {activeTab === "plans" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {plans.map((p) => (
                  <div
                    key={p.id}
                    className="card-modern hover:border-primary transition-colors flex flex-col"
                  >
                    <h3 className="text-xl font-bold text-white mb-2">{p.title}</h3>
                    <div className="flex flex-col mb-4 text-sm gap-1">
                      <span className="text-dark-muted">
                        Soumis le: {formatDateTime(p.createdAt)}
                      </span>
                      {p.status === "Approuvé" && (
                        <span className="text-dark-muted">
                          Approuvé le: {formatDateTime(p.updatedAt)}
                        </span>
                      )}
                    </div>
                    <span
                      className={`px-2 py-1 rounded font-bold mb-2 ${
                        p.status === "Approuvé"
                          ? "text-green-400 bg-green-900/20"
                          : "text-orange-400 bg-orange-900/20"
                      }`}
                    >
                      {p.status}
                    </span>
                    <div className="mt-auto flex gap-2 pt-4 border-t border-dark-border">
                      <a
                        href={p.pdfUrl}
                        target="_blank"
                        className="flex-1 py-2 bg-dark-bg hover:bg-dark-border rounded text-center text-sm"
                      >
                        PDF
                      </a>
                      {p.status !== "Approuvé" && (
                        <button
                          onClick={() => {
                            setEditingPlan(p);
                            setAnswers(p.answers);
                            setActiveTab("new");
                          }}
                          className="flex-1 py-2 bg-primary rounded text-sm"
                        >
                          Modifier
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          if (confirm("Supprimer?")) {
                            await deleteDoc(doc(db, "coursePlans", p.id));
                            setPlans(plans.filter((x) => x.id !== p.id));
                          }
                        }}
                        className="px-3 bg-red-500/20 text-red-400 rounded"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "new" && (
              <div className="max-w-4xl mx-auto card-modern">
                <h2 className="text-2xl font-bold text-white mb-6 border-b border-dark-border pb-4">
                  {editingPlan ? "Modifier" : "Nouveau plan"}
                </h2>
                {!formTemplate ? (
                  <p>Aucun formulaire actif.</p>
                ) : (
                  <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
                    {formTemplate.questions.map((q, i) => (
                      <div key={q.id}>
                        <label className="block text-lg font-medium text-white mb-2">
                          {i + 1}. {q.label}
                        </label>
                        <p className="text-sm text-primary mb-2 italic">ℹ️ {q.rule}</p>
                        <textarea
                          className="input-modern min-h-[100px]"
                          value={answers[q.id] || ""}
                          onChange={(e) => handleInputChange(q.id, e.target.value)}
                          placeholder="Votre réponse..."
                        />
                      </div>
                    ))}
                    <div className="flex gap-4 pt-4">
                      <button
                        id="analyze-btn"
                        onClick={analyzePlan}
                        className="btn-primary bg-purple-600 hover:bg-purple-500"
                      >
                        ✨ Analyser
                      </button>

                      {/* Bouton soumettre amélioré */}
                      <button
                        onClick={handleSubmitPlan}
                        className={`btn-primary flex-1 ${
                          !analysis ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                        title={
                          !analysis
                            ? "Vous devez analyser les réponses avec l'IA avant de soumettre"
                            : ""
                        }
                      >
                        {submitting ? "Envoi..." : "Soumettre"}
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
                        <h3 className="font-bold mb-2">{analysis.status}</h3>
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
    </div>
  );
}
