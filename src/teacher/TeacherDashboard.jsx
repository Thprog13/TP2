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
  serverTimestamp,
  deleteDoc,
  doc,
  orderBy,
  limit,
  setDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { jsPDF } from "jspdf";

// ⭐ FONCTION UNIQUE pour formater l'horodatage en date et heure
const formatDateTime = (timestamp) => {
  if (!timestamp) return "N/A";
  
  // Convertit l'horodatage Firestore en objet Date
  const date = timestamp.toDate(); 
  
  // Formate la date et l'heure (Ex: 27/11/2025 à 12:16)
  return date.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).replace(',', ' à '); // Remplace la virgule (si présente) par ' à '
};

export default function TeacherDashboard() {
  const [activeTab, setActiveTab] = useState("new");

  const [plans, setPlans] = useState([]);

  // --- NOUVEAU : État pour le formulaire dynamique ---
  const [formTemplate, setFormTemplate] = useState(null);
  const [answers, setAnswers] = useState({}); // Format: { "id_question": "réponse" }

  const [analysis, setAnalysis] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // NOUVEL ÉTAT : Pour savoir si on est en mode édition
  const [editingPlan, setEditingPlan] = useState(null);

  const currentUser = auth.currentUser;

  /* ===== 1. Charger les plans existants ===== */
  useEffect(() => {
    const loadPlans = async () => {
      if (!currentUser) return;

      const q = query(
        collection(db, "coursePlans"),
        where("teacherId", "==", currentUser.uid)
      );

      const snap = await getDocs(q);
      setPlans(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };

    loadPlans();
  }, [currentUser, activeTab]);

  /* ===== 2. Charger le modèle de formulaire ACTIF ou celui du Plan en édition (MODIFIÉ) ===== */
  useEffect(() => {
    const loadFormTemplate = async () => {
      // 1. Si on est en mode édition, on utilise le snapshot des questions du plan existant
      if (editingPlan) {
        setFormTemplate({
          id: editingPlan.formId,
          questions: editingPlan.questionsSnapshot,
        });
        return;
      }

      // 2. Si on est en mode création (new), on charge le dernier formulaire créé
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

        // Initialiser les réponses vides
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

  /* ===== Gestion des champs dynamiques ===== */
  const handleInputChange = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  /* ===== Analyse IA (Basée sur les règles du coordonnateur) ===== */
  const analyzePlan = () => {
    if (!formTemplate || !formTemplate.questions) return;

    const feedback = [];
    let isConform = true;

    // On vérifie chaque question selon sa règle (Simulation locale pour l'instant)
    formTemplate.questions.forEach((q) => {
      const answerText = answers[q.id] || "";
      // const rule = q.rule || ""; 

      // Vérification basique : longueur minimale
      if (answerText.length < 10) {
        isConform = false;
        feedback.push(`Question "${q.label}" : Réponse trop courte.`);
      }

      // Ici, on connectera plus tard l'API OpenAI
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

  /* ===== Soumission/Mise à jour du Plan (MODIFIÉ) ===== */
  const handleSubmitPlan = async () => {
    if (!analysis) return alert("Analyse IA requise");
    setSubmitting(true);

    // --- 1. Génération PDF Dynamique ---
    const docPDF = new jsPDF();
    docPDF.setFontSize(18);
    docPDF.text("Plan de cours", 10, 10);
    docPDF.setFontSize(12);

    let y = 20;
    if (formTemplate && formTemplate.questions) {
      formTemplate.questions.forEach((q) => {
        docPDF.setFont("helvetica", "bold");
        docPDF.text(`Q: ${q.label}`, 10, y);
        y += 7;

        docPDF.setFont("helvetica", "normal");
        const reponse = answers[q.id] || "";
        const splitText = docPDF.splitTextToSize(reponse, 180);
        docPDF.text(splitText, 10, y);
        y += splitText.length * 7 + 10;

        if (y > 270) {
          docPDF.addPage();
          y = 10;
        }
      });
    }

    // --- 2. Upload PDF ---
    const blob = docPDF.output("blob");
    const filePath = `plans/${currentUser.uid}/plan_${Date.now()}.pdf`;

    await uploadBytes(ref(storage, filePath), blob);
    const pdfUrl = await getDownloadURL(ref(storage, filePath));

    // --- 3. Sauvegarde/Mise à jour dans Firestore ---
    const planData = {
      teacherId: currentUser.uid,
      // Conserve la date de création originale, ou l'initialise
      createdAt: editingPlan?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(), // Nouvelle date de mise à jour
      formId: formTemplate?.id,
      questionsSnapshot: formTemplate?.questions,
      answers: answers,
      
      // LOGIQUE DU STATUT : 
      status: editingPlan?.status === "Approuvé" 
                ? "En révision" 
                : (editingPlan?.status || "Soumis"),
      
      // LOGIQUE DE LA DATE D'APPROBATION : 
      // On conserve la date d'approbation existante si elle est présente.
      approvedAt: editingPlan?.approvedAt || null, 
      
      pdfUrl,
    };

    if (editingPlan) {
      // MISE À JOUR (UPDATE)
      await setDoc(doc(db, "coursePlans", editingPlan.id), planData, { merge: true });
      alert("Plan mis à jour !");
    } else {
      // CRÉATION (ADD)
      await addDoc(collection(db, "coursePlans"), planData);
      alert("Nouveau plan enregistré !");
    }

    // --- 4. Reset et nettoyage ---
    setAnswers({});
    setAnalysis(null);
    setSubmitting(false);
    setEditingPlan(null); // Quitter le mode édition

    // Recharger la liste
    const q = query(
      collection(db, "coursePlans"),
      where("teacherId", "==", currentUser.uid)
    );
    const snap = await getDocs(q);
    setPlans(snap.docs.map((d) => ({ id: d.id, ...d.data() })));

    // Rediriger vers l'onglet "Mes plans"
    setActiveTab("plans");
  };

  /* ===== Delete Plan (Gardé tel quel) ===== */
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

  /* ===== Edit Plan (MODIFIÉ) ===== */
  const handleEditPlan = (plan) => {
    // 1. Définir le plan en cours d'édition
    setEditingPlan(plan);

    // 2. Charger les réponses du plan existant dans l'état `answers`
    if (plan.answers) {
      setAnswers(plan.answers);
    }

    // 3. Réinitialiser l'analyse pour forcer une nouvelle analyse avant la soumission
    setAnalysis(null);

    // 4. Changer d'onglet pour afficher le formulaire
    setActiveTab("new");
  };

  return (
    <>
      <Navbar />

      <div className="dashboard-container">
        <SidebarTeacher activeTab={activeTab} setActiveTab={setActiveTab} />

        <div className="dashboard-content">
          {/* ================= PLANS ================= */}
          {activeTab === "plans" && (
            <div className="card">
              <h2>Mes plans de cours</h2>
              {plans.length === 0 ? (
                <p>Aucun plan</p>
              ) : (
                plans.map((p) => (
                  <div key={p.id} className="submit-item">
                    
                    {/* ⭐ NOUVEAU : Affichage du nom du cours (titre) */}
                    <h3>{p.answers?.[1764218126528] || "Plan sans titre"}</h3>
                    
                    <p>
                      {/* Date et heure de création */}
                      <strong>Date de création :</strong>{" "}
                      {formatDateTime(p.createdAt)}
                    </p>

                    {/* Date et heure de modification (si plus récente) */}
                    {p.updatedAt && 
                        (p.createdAt && p.updatedAt.seconds > p.createdAt.seconds) && (
                        <p>
                            <strong>Dernière modification :</strong> {formatDateTime(p.updatedAt)}
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
                        {/* Date et heure d'approbation affichées à côté du statut */}
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
                      
                      {/* L'édition est permise si le plan n'est pas "Approuvé" */}
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

          {/* ================= REMISES (Si utilisé) ================= */}
          {activeTab === "submits" && (
            <div className="card">
              <h2>Remises</h2>
              <p>Fonctionnalité à venir</p>
            </div>
          )}

          {/* ================= SETTINGS ================= */}
          {activeTab === "settings" && <TeacherSettings />}

          {/* ================= NEW PLAN (DYNAMIQUE) ================= */}
          {activeTab === "new" && (
            <div className="card">
              <h2>{editingPlan ? "Modifier le plan" : "Remplir le plan de cours"}</h2>

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
                  {/* Boucle sur les questions dynamiques */}
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

                        {/* Affichage discret de la règle pour aider l'enseignant */}
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
                          // La valeur est initialisée par l'état `answers`
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
                        ? "Mettre à jour le plan" // Texte adapté en mode édition
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