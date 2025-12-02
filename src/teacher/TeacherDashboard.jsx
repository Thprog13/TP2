import SidebarTeacher from "./SidebarTeacher";
import TeacherSettings from "./TeacherSettings";
import Navbar from "../components/Navbar";
import React, { useEffect, useState } from "react";
import "./TeacherDashboard.css";
import { auth, db, storage } from "../firebase";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  getDoc,
  serverTimestamp,
  deleteDoc,
  doc,
  orderBy,
  limit,
  setDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { jsPDF } from "jspdf";

const formatDateTime = (timestamp) => {
  if (!timestamp) return "N/A";
  const date = timestamp.toDate();
  return date
    .toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(",", " à ");
};

export default function TeacherDashboard() {
  const [activeTab, setActiveTab] = useState("new");
  const [plans, setPlans] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [formTemplate, setFormTemplate] = useState(null);
  const [answers, setAnswers] = useState({});
  const [analysis, setAnalysis] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);

  const currentUser = auth.currentUser;

  useEffect(() => {
    const loadTemplates = async () => {
      const tq = query(
        collection(db, "formTemplates"),
        where("active", "==", true),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(tq);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTemplates(list);
      if (!selectedTemplateId && list.length > 0 && !editingPlan) {
        setSelectedTemplateId(list[0].id);
      }
    };
    loadTemplates();
  }, [editingPlan, selectedTemplateId]);

  useEffect(() => {
    const loadFormTemplate = async () => {
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
        const newFormTemplate = { id: snap.docs[0].id, ...data };
        setFormTemplate(newFormTemplate);

        const initAnswers = {};
        if (data.questions) {
          data.questions.forEach((q) => {
            initAnswers[q.id] = "";
          });
        }
        if (!editingPlan) {
          setAnswers(initAnswers);
        }
      } else {
        setFormTemplate(null);
        setAnswers({});
      }
    };

    if (activeTab === "new") {
      loadFormTemplate();
    }
  }, [activeTab, editingPlan]);

  useEffect(() => {
    if (activeTab === "plans" && currentUser) {
      const loadPlans = async () => {
        const q = query(
          collection(db, "coursePlans"),
          where("teacherId", "==", currentUser.uid),
          orderBy("createdAt", "desc")
        );

        try {
          const snap = await getDocs(q);
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setPlans(list);
        } catch (error) {
          console.error("[ERREUR FIRESTORE] Erreur de chargement des plans:", error.message);
        }
      };
      loadPlans();
    }
  }, [activeTab, currentUser]);

  const handleInputChange = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const analyzePlan = () => {
    if (!formTemplate || !formTemplate.questions) return;

    const feedback = [];
    let isConform = true;

    formTemplate.questions.forEach((q) => {
      const answerText = answers[q.id] || "";
      if (answerText.length < 10) {
        isConform = false;
        feedback.push(`Question "${q.label}" : Réponse trop courte.`);
      }
    });

    if (isConform) {
      setAnalysis({
        status: "Conforme",
        suggestions: ["Le plan respecte les critères de base."],
      });
    } else {
      setAnalysis({
        status: "Non conforme",
        suggestions: feedback,
      });
    }
  };

  const handleSubmitPlan = async () => {
    if (!analysis) return alert("Analyse IA requise");
    setSubmitting(true);

    let teacherName = currentUser?.displayName;
    if (!teacherName) {
      try {
        const userSnap = await getDoc(doc(db, "users", currentUser.uid));
        if (userSnap.exists()) {
          const uData = userSnap.data();
          teacherName = `${uData.firstName || ""} ${uData.lastName || ""}`.trim();
        }
      } catch (e) {
        console.error("Erreur récupération user", e);
      }
    }
    if (!teacherName) teacherName = currentUser?.email || "Enseignant";

    const titleQuestion =
      formTemplate.questions.find((q) =>
        q.label.toLowerCase().includes("titre")
      ) || formTemplate.questions[0];

    const finalTitle = answers[titleQuestion.id] || "Plan sans titre";

    const docPDF = new jsPDF({
      unit: "mm",
      format: "a4",
      orientation: "portrait",
    });

    const pageWidth = docPDF.internal.pageSize.getWidth();
    const pageHeight = docPDF.internal.pageSize.getHeight();
    const margin = 14;
    let cursorY = 20;

    docPDF.setFont("helvetica", "bold");
    docPDF.setFontSize(20);
    docPDF.setTextColor(33, 66, 110);
    docPDF.text("PLAN DE COURS", margin, cursorY);

    cursorY += 10;

    docPDF.setFont("helvetica", "normal");
    docPDF.setFontSize(11);
    docPDF.setTextColor(40);

    docPDF.text(`Enseignant: ${teacherName}`, margin, cursorY);
    cursorY += 6;
    docPDF.text(`Cours: ${finalTitle}`, margin, cursorY);

    const generatedDate = new Date().toLocaleDateString("fr-FR");
    const iaStatus = analysis ? analysis.status : "Non évalué";
    docPDF.setFontSize(10);
    docPDF.setTextColor(90);

    const metaLines = [
      `Date de génération: ${generatedDate}`,
      `Statut IA: ${iaStatus}`,
    ];

    const metaX = pageWidth - margin;

    metaLines.forEach((line, i) => {
      const tw = docPDF.getTextWidth(line);
      docPDF.text(line, metaX - tw, cursorY - 12 + i * 5);
    });

    cursorY += 10;

    docPDF.setDrawColor(200);
    docPDF.setLineWidth(0.5);
    docPDF.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 10;

    docPDF.setFontSize(12);

    if (formTemplate && formTemplate.questions) {
      formTemplate.questions.forEach((q, idx) => {
        docPDF.setFont("helvetica", "bold");
        docPDF.setFontSize(12);
        docPDF.setTextColor(30, 97, 196);
        docPDF.text(`Question ${idx + 1}: ${q.label}`, margin, cursorY);
        cursorY += 6;

        const boxX = margin;
        const boxW = pageWidth - margin * 2;
        const textX = boxX + 8;
        const leftAccentW = 3;
        const innerWidth = boxW - (textX - boxX) - 8;

        docPDF.setFont("helvetica", "normal");
        docPDF.setFontSize(11);
        docPDF.setTextColor(30);

        const answer = answers[q.id] || "";
        const wrapped = docPDF.splitTextToSize(
          answer || "(Aucune réponse fournie)",
          innerWidth
        );

        const lineHeight = 6;
        const boxPadding = 8;
        const boxH = Math.max(20, wrapped.length * lineHeight + boxPadding);

        if (cursorY + boxH + 30 > pageHeight) {
          docPDF.addPage();
          cursorY = 20;
        }

        docPDF.setFillColor(245, 246, 248);
        docPDF.roundedRect(boxX, cursorY, boxW, boxH, 2, 2, "F");

        docPDF.setFillColor(30, 97, 196);
        docPDF.rect(boxX, cursorY, leftAccentW, boxH, "F");

        const textY = cursorY + 7;
        docPDF.setTextColor(20);
        docPDF.text(wrapped, textX, textY);

        cursorY += boxH + 10;
      });
    }

    const pageCount = docPDF.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      docPDF.setPage(i);
      docPDF.setDrawColor(230);
      docPDF.setLineWidth(0.4);
      docPDF.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);

      docPDF.setFontSize(9);
      docPDF.setTextColor(120);
      docPDF.text(`Généré le ${generatedDate}`, margin, pageHeight - 10);

      const label = `Page ${i} / ${pageCount}`;
      const tw = docPDF.getTextWidth(label);
      docPDF.text(label, pageWidth - margin - tw, pageHeight - 10);
    }

    const blob = docPDF.output("blob");
    const filePath = `plans/${currentUser.uid}/plan_${Date.now()}.pdf`;

    await uploadBytes(ref(storage, filePath), blob);
    const pdfUrl = await getDownloadURL(ref(storage, filePath));

    const planData = {
      teacherId: currentUser.uid,
      createdAt: editingPlan?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
      formId: formTemplate?.id,
      questionsSnapshot: formTemplate?.questions,
      title: finalTitle,
      answers: answers,
      status:
        editingPlan?.status === "Approuvé"
          ? "En révision"
          : editingPlan?.status || "Soumis",
      approvedAt: editingPlan?.approvedAt || null,
      pdfUrl,
    };

    if (editingPlan) {
      await setDoc(doc(db, "coursePlans", editingPlan.id), planData, {
        merge: true,
      });
      alert("Plan mis à jour !");
    } else {
      await addDoc(collection(db, "coursePlans"), planData);
      alert("Nouveau plan enregistré !");
    }

    setAnswers({});
    setAnalysis(null);
    setSubmitting(false);
    setEditingPlan(null);

    const q = query(
      collection(db, "coursePlans"),
      where("teacherId", "==", currentUser.uid)
    );
    const snap = await getDocs(q);
    setPlans(snap.docs.map((d) => ({ id: d.id, ...d.data() })));

    setActiveTab("plans");
  };

  const handleDeletePlan = async (planId) => {
    if (!window.confirm("Voulez-vous vraiment supprimer ce plan ?")) return;

    try {
      await deleteDoc(doc(db, "coursePlans", planId));
      setPlans(plans.filter((p) => p.id !== planId));
    } catch (error) {
      console.error("Erreur suppression :", error);
      alert("Erreur lors de la suppression");
    }
  };

  const handleEditPlan = (plan) => {
    setEditingPlan(plan);
    if (plan.answers) {
      setAnswers(plan.answers);
    }
    setAnalysis(null);
    setActiveTab("new");
  };

  return (
    <>
      <Navbar />

      <div className="dashboard-container">
        <SidebarTeacher activeTab={activeTab} setActiveTab={setActiveTab} />

        <div className="dashboard-content">
          {activeTab === "plans" && (
            <div className="card">
              <h2>Mes plans de cours</h2>
              {plans.length === 0 ? (
                <p>Aucun plan</p>
              ) : (
                plans.map((p) => (
                  <div key={p.id} className="submit-item">
                    <h3>
                      {p.title ||
                        p.answers?.[Object.keys(p.answers)[0]] ||
                        "Plan sans titre"}
                    </h3>

                    <p>
                      <strong>Date de création :</strong>{" "}
                      {formatDateTime(p.createdAt)}
                    </p>

                    {p.updatedAt &&
                      p.createdAt &&
                      p.updatedAt.seconds > p.createdAt.seconds && (
                        <p>
                          <strong>Dernière modification :</strong>{" "}
                          {formatDateTime(p.updatedAt)}
                        </p>
                      )}

                    <p>
                      <strong>Statut :</strong>{" "}
                      <span
                        style={{
                          fontWeight: "bold",
                          color:
                            p.status === "Approuvé"
                              ? "green"
                              : p.status === "Non conforme"
                              ? "red"
                              : "orange",
                        }}
                      >
                        {p.status}
                        {p.status === "Approuvé" && p.approvedAt && (
                          <span className="approval-date">
                            &nbsp;(le {formatDateTime(p.approvedAt)})
                          </span>
                        )}
                      </span>
                    </p>

                    <div className="action-buttons">
                      <a
                        href={p.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-link"
                        style={{ marginRight: "10px" }}
                      >
                        Voir PDF
                      </a>

                      {p.status !== "Approuvé" && (
                        <button
                          className="btn-primary"
                          style={{ padding: "5px 10px", fontSize: "14px" }}
                          onClick={() => handleEditPlan(p)}
                        >
                          Modifier
                        </button>
                      )}

                      <button
                        className="delete-btn"
                        style={{
                          padding: "5px 10px",
                          fontSize: "14px",
                          marginLeft: "10px",
                        }}
                        onClick={() => handleDeletePlan(p.id)}
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "submits" && (
            <div className="card">
              <h2>Remises</h2>
              <p>Fonctionnalité à venir</p>
            </div>
          )}

          {activeTab === "settings" && <TeacherSettings />}

          {activeTab === "new" && (
            <div className="card">
              <h2>
                {editingPlan ? "Modifier le plan" : "Remplir le plan de cours"}
              </h2>

              {!formTemplate ? (
                <div
                  style={{
                    padding: "20px",
                    background: "#fee2e2",
                    color: "#b91c1c",
                    borderRadius: "8px",
                  }}
                >
                  ⚠️ Aucun formulaire actif n'a été trouvé. Demandez au
                  coordonnateur d'en créer un.
                </div>
              ) : (
                <form onSubmit={(e) => e.preventDefault()}>
                  {formTemplate.questions &&
                    formTemplate.questions.map((q, index) => (
                      <div
                        key={q.id}
                        className="form-group"
                        style={{ marginBottom: "25px" }}
                      >
                        <div
                          className="word-label"
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <span>
                            {index + 1}. {q.label}
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: "13px",
                            color: "#666",
                            marginBottom: "8px",
                            fontStyle: "italic",
                          }}
                        >
                          ℹ️ Attendu par l'IA : {q.rule}
                        </div>

                        <textarea
                          className="desc-fixed"
                          placeholder="Votre réponse ici..."
                          value={answers[q.id] || ""}
                          onChange={(e) =>
                            handleInputChange(q.id, e.target.value)
                          }
                          style={{ minHeight: "100px" }}
                        />
                      </div>
                    ))}

                  <button
                    type="button"
                    className="btn-primary"
                    onClick={analyzePlan}
                  >
                    Analyser mes réponses (IA)
                  </button>

                  {analysis && (
                    <div className="analysis-box" style={{ marginTop: "20px" }}>
                      <h3>Résultat de l'analyse : {analysis.status}</h3>
                      <ul>
                        {analysis.suggestions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="submit-container">
                    <button
                      className="submit-btn"
                      onClick={handleSubmitPlan}
                      disabled={submitting || !analysis}
                      style={{ opacity: submitting || !analysis ? 0.5 : 1 }}
                    >
                      {submitting
                        ? "Envoi en cours..."
                        : editingPlan
                        ? "Mettre à jour le plan"
                        : "Soumettre le plan"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
