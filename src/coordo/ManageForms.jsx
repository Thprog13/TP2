import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";

export default function ManageForms() {
  const [questions, setQuestions] = useState([]);
  const [activeFormId, setActiveFormId] = useState(null);

  // Charger le formulaire actif s'il existe
  useEffect(() => {
    const loadForms = async () => {
      const q = query(
        collection(db, "formTemplates"),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setQuestions(data.questions || []);
        setActiveFormId(snap.docs[0].id);
      }
    };
    loadForms();
  }, []);

  const addQuestion = () => {
    setQuestions([...questions, { id: Date.now(), label: "", rule: "" }]);
  };

  const updateQuestion = (index, field, value) => {
    const newQuestions = [...questions];
    newQuestions[index][field] = value;
    setQuestions(newQuestions);
  };

  const deleteQuestion = (index) => {
    const newQuestions = [...questions];
    newQuestions.splice(index, 1);
    setQuestions(newQuestions);
  };

  const saveForm = async () => {
    if (questions.length === 0) return alert("Ajoutez au moins une question.");

    try {
      await addDoc(collection(db, "formTemplates"), {
        questions,
        createdAt: new Date(),
        active: true,
      });
      alert("Formulaire sauvegardé et activé !");
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la sauvegarde.");
    }
  };

  return (
    <div className="card">
      <h2>Gestion du formulaire de plan de cours</h2>
      <p>Définissez les questions et les règles de validation pour l'IA.</p>

      {questions.map((q, i) => (
        <div
          key={q.id}
          style={{
            marginBottom: "20px",
            padding: "15px",
            border: "1px solid #ddd",
            borderRadius: "8px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>Question #{i + 1}</strong>
            <button
              onClick={() => deleteQuestion(i)}
              style={{
                background: "#ef4444",
                color: "white",
                padding: "4px 8px",
                fontSize: "12px",
              }}
            >
              Supprimer
            </button>
          </div>

          <div className="word-label">Intitulé de la question :</div>
          <input
            className="word-input"
            value={q.label}
            placeholder="Ex: Description du cours..."
            onChange={(e) => updateQuestion(i, "label", e.target.value)}
          />

          <div className="word-label">Règle de validation IA :</div>
          <textarea
            className="desc-fixed"
            style={{ minHeight: "80px" }}
            value={q.rule}
            placeholder="Ex: Vérifier que le texte contient au moins 100 mots et mentionne les objectifs."
            onChange={(e) => updateQuestion(i, "rule", e.target.value)}
          />
        </div>
      ))}

      <button
        className="word-add"
        onClick={addQuestion}
        style={{
          background: "none",
          border: "none",
          fontSize: "16px",
          marginTop: "10px",
        }}
      >
        + Ajouter une question
      </button>

      <div style={{ marginTop: "30px" }}>
        <button className="btn-primary" onClick={saveForm}>
          Sauvegarder le modèle
        </button>
      </div>
    </div>
  );
}
