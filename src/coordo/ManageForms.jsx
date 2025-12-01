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
  serverTimestamp
} from "firebase/firestore";

// =======================================================================
// 1. HOOK D'AUTHENTIFICATION RÉEL (Lit l'UID et le rôle dans Firestore)
// =======================================================================
const useAuthInfo = () => {
    const [authInfo, setAuthInfo] = useState({ currentUserId: null, userRole: null });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async user => {
            if (user) {
                try {
                    const ref = doc(db, "users", user.uid);
                    const snap = await getDoc(ref);
                    let storedRole = null;
                    if (snap.exists()) {
                        storedRole = snap.data().role; 
                    }
                    setAuthInfo({
                        currentUserId: user.uid, 
                        userRole: storedRole || null,
                    });
                } catch (error) {
                    console.error("Erreur lors de la récupération du rôle:", error);
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
// =======================================================================
// FIN DU HOOK
// =======================================================================

// --- Modèle de données par défaut pour un plan de cours ---
const defaultCoursePlan = () => ({
  meta: {
    title: "",
    objective: "",
    description: "",
  },
  weeks: [
    { id: 1, label: "Semaine 1", learning: "", homework: "" },
  ],
  exams: [
    // Exemple: { id: 1, title: "Examen final", date: "", coverage: "" }
  ],
  // Questions + règles IA de validation (liées aux champs ci-dessus)
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
  // Etat principal du modèle
  const [coursePlan, setCoursePlan] = useState(defaultCoursePlan());
  const [activeFormId, setActiveFormId] = useState(null);
  const [templatesList, setTemplatesList] = useState([]);

  // 2. Auth
  const { currentUserId, userRole, isLoading } = useAuthInfo();

  // Charger les modèles avec filtre par rôle
   const loadForms = async () => {
    if (isLoading || !currentUserId || !userRole) return;

    let formsQuery;
    if (userRole === "coordonator") {
      // Remove orderBy to avoid composite index requirement
      formsQuery = query(
        collection(db, "formTemplates"),
        where("creatorId", "==", currentUserId)
      );
    } else {
      // Keep simple orderBy for unfiltered listing
      formsQuery = query(collection(db, "formTemplates"), orderBy("createdAt", "desc"));
    }

    const allSnap = await getDocs(formsQuery);
    let loadedTemplates = allSnap.docs.map(d => ({
      id: d.id,
      ...d.data(),
    }));

    loadedTemplates.sort((a, b) => {
      const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
      const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
      return tb - ta;
    });
      setTemplatesList(loadedTemplates);

    const activeForm = loadedTemplates.length > 0 ? loadedTemplates[0] : null;
    if (activeForm) {
      setActiveFormId(activeForm.id);
      setCoursePlan({
        meta: activeForm.meta || { title: "", objective: "", description: "" },
        weeks: activeForm.weeks || [{ id: 1, label: "Semaine 1", learning: "", homework: "" }],
        exams: activeForm.exams || [],
        questions: activeForm.questions || defaultCoursePlan().questions,
      });
    } else {
      setActiveFormId(null);
      setCoursePlan(defaultCoursePlan());
    }
  };

  useEffect(() => {
    loadForms();
  }, [currentUserId, userRole, isLoading]);

  // Helpers de mise à jour
  const updateMeta = (field, value) => {
    setCoursePlan(prev => ({ ...prev, meta: { ...prev.meta, [field]: value } }));
  };

  const addWeek = () => {
    setCoursePlan(prev => ({
      ...prev,
      weeks: [
        ...prev.weeks,
        {
          id: (prev.weeks[prev.weeks.length - 1]?.id || 0) + 1,
          label: `Semaine ${prev.weeks.length + 1}`,
          learning: "",
          homework: "",
        },
      ],
    }));
  };

  const updateWeek = (index, field, value) => {
    setCoursePlan(prev => {
      const weeks = [...prev.weeks];
      weeks[index] = { ...weeks[index], [field]: value };
      return { ...prev, weeks };
    });
  };

  const removeWeek = (index) => {
    setCoursePlan(prev => {
      const weeks = [...prev.weeks];
      weeks.splice(index, 1);
      // Re-labeller après suppression
      const relabeled = weeks.map((w, i) => ({ ...w, label: `Semaine ${i + 1}`, id: i + 1 }));
      return { ...prev, weeks: relabeled };
    });
  };

  const addExam = () => {
    setCoursePlan(prev => ({
      ...prev,
      exams: [
        ...prev.exams,
        {
          id: (prev.exams[prev.exams.length - 1]?.id || 0) + 1,
          title: "",
          date: "",
          coverage: "",
        },
      ],
    }));
  };

  const updateExam = (index, field, value) => {
    setCoursePlan(prev => {
      const exams = [...prev.exams];
      exams[index] = { ...exams[index], [field]: value };
      return { ...prev, exams };
    });
  };

  const removeExam = (index) => {
    setCoursePlan(prev => {
      const exams = [...prev.exams];
      exams.splice(index, 1);
      const relabeled = exams.map((e, i) => ({ ...e, id: i + 1 }));
      return { ...prev, exams: relabeled };
    });
  };

  // Supprimer un template
  const deleteTemplate = async (templateId) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce modèle ?")) return;
    if (userRole !== 'coordonator' && userRole !== 'teacher') return alert("Action non autorisée."); 
    try {
      await deleteDoc(doc(db, "formTemplates", templateId));
      setTemplatesList(templatesList.filter(t => t.id !== templateId)); 
      if (activeFormId === templateId) { setCoursePlan(defaultCoursePlan()); setActiveFormId(null); }
      alert("Modèle supprimé avec succès !");
    } catch (e) {
      console.error("Erreur de suppression:", e);
      alert("Erreur lors de la suppression du modèle.");
    }
  };

  const editTemplate = (template) => {
    setActiveFormId(template.id);
    setCoursePlan({
      meta: template.meta || { title: "", objective: "", description: "" },
      weeks: template.weeks || [{ id: 1, label: "Semaine 1", learning: "", homework: "" }],
      exams: template.exams || [],
      questions: template.questions || defaultCoursePlan().questions,
    });
    window.scrollTo(0, 0); 
    alert(`Modèle '${template.id}' chargé pour modification.`);
  };

  // Sauvegarder
  const saveForm = async () => {
  // Validations basiques côté client
  if (!coursePlan.meta.title.trim()) return alert("Le titre du cours est obligatoire.");
  if (!coursePlan.meta.objective.trim()) return alert("L’objectif du cours est obligatoire.");
  if (!coursePlan.meta.description.trim()) return alert("La description du cours est obligatoire.");
  if (!currentUserId) return alert("Erreur d'authentification. Veuillez vous reconnecter.");

  try {
    const payload = {
      meta: coursePlan.meta,
      weeks: coursePlan.weeks,
      exams: coursePlan.exams,
      questions: coursePlan.questions, // règles IA incluses
      updatedAt: serverTimestamp(), // <-- use Firestore timestamp
    };

    if (activeFormId) {
      const formRef = doc(db, "formTemplates", activeFormId);
      await updateDoc(formRef, payload);
      await loadForms();
      alert("Modèle de plan de cours mis à jour !");
    } else {
      const newDoc = await addDoc(collection(db, "formTemplates"), {
        ...payload,
        createdAt: serverTimestamp(), // <-- use Firestore timestamp
        active: true,
        creatorId: currentUserId,
        type: "course-plan",
      });
      setActiveFormId(newDoc.id);
      await loadForms();
      alert("Nouveau modèle de plan de cours sauvegardé et activé !");
    }
  } catch (e) {
    console.error("Error saving form:", e);
    alert(`Erreur lors de la sauvegarde: ${e?.message || e}`);
  }
};

  // ==================================================
  // 3. GESTION DE L'ÉTAT ET DES ACCÈS AU RENDU
  // ==================================================
  if (isLoading) {
    return <div className="card">Chargement des permissions...</div>;
  }
  if (!currentUserId) {
    return <div className="card">Veuillez vous connecter pour gérer les formulaires.</div>;
  }
  if (!userRole) {
    return (
      <div className="card">
        Accès refusé. Votre compte est connecté (UID: {currentUserId.substring(0, 5)}...), mais le rôle n'a pas pu être chargé depuis la base de données.
        <br/><br/>
        <strong>Vérification requise :</strong> Assurez-vous que le document de cet utilisateur dans la collection <strong>"users"</strong> contient le champ <strong>"role"</strong>.
      </div>
    );
  }
  if (userRole !== 'coordonator' && userRole !== 'teacher') {
    return <div className="card">Accès refusé. Votre rôle ({userRole}) n'a pas les droits de gestion (seuls 'coordonator' et 'teacher' sont autorisés).</div>;
  }

  // --- RENDU ---
  return (
    <div>
      <div className="card">
        <h2>{activeFormId ? `Édition du plan de cours (${activeFormId})` : "Créer un modèle de plan de cours"}</h2>
        <p>Définissez les champs du plan de cours, la planification hebdomadaire et les évaluations. Des règles de validation IA sont associées à chaque section.</p>

        {/* Métadonnées du cours */}
        <div style={{ marginBottom: "20px", padding: "15px", border: "1px solid #ddd", borderRadius: "8px" }}>
          <strong>Informations du cours</strong>
          <div className="word-label">Titre du cours :</div>
          <input
            className="word-input"
            value={coursePlan.meta.title}
            placeholder="Ex: Programmation Web 2"
            onChange={(e) => updateMeta("title", e.target.value)}
          />

          <div className="word-label">Objectif du cours :</div>
          <textarea
            className="desc-fixed"
            style={{ minHeight: "60px" }}
            value={coursePlan.meta.objective}
            placeholder="Décrire les compétences et objectifs pédagogiques."
            onChange={(e) => updateMeta("objective", e.target.value)}
          />

          <div className="word-label">Description du cours :</div>
          <textarea
            className="desc-fixed"
            style={{ minHeight: "100px" }}
            value={coursePlan.meta.description}
            placeholder="Décrire les contenus, méthodes, ressources, prérequis, etc."
            onChange={(e) => updateMeta("description", e.target.value)}
          />
        </div>

        {/* Semaines */}
        <div style={{ marginBottom: "20px", padding: "15px", border: "1px solid #ddd", borderRadius: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>Planification hebdomadaire</strong>
            <button
              onClick={addWeek}
              style={{ background: "none", border: "1px solid #3b82f6", color: "#3b82f6", padding: "4px 8px", fontSize: "12px", borderRadius: "4px" }}
            >
              + Ajouter une semaine
            </button>
          </div>

          {coursePlan.weeks.map((w, i) => (
            <div key={w.id} style={{ marginTop: "12px", padding: "12px", border: "1px dashed #ddd", borderRadius: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>{w.label}</strong>
                <button
                  onClick={() => removeWeek(i)}
                  style={{ background: "#ef4444", color: "white", padding: "4px 8px", fontSize: "12px", borderRadius: "4px" }}
                >
                  Supprimer
                </button>
              </div>

              <div className="word-label" style={{ marginTop: "8px" }}>Ce qui sera appris :</div>
              <textarea
                className="desc-fixed"
                style={{ minHeight: "60px" }}
                value={w.learning}
                placeholder="Contenu, notions, activités en classe."
                onChange={(e) => updateWeek(i, "learning", e.target.value)}
              />

              <div className="word-label">Devoirs / travail à la maison :</div>
              <textarea
                className="desc-fixed"
                style={{ minHeight: "60px" }}
                value={w.homework}
                placeholder="Exercices, lectures, projets à remettre."
                onChange={(e) => updateWeek(i, "homework", e.target.value)}
              />
            </div>
          ))}
        </div>

        {/* Examens */}
        <div style={{ marginBottom: "20px", padding: "15px", border: "1px solid #ddd", borderRadius: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>Examens / Évaluations</strong>
            <button
              onClick={addExam}
              style={{ background: "none", border: "1px solid #3b82f6", color: "#3b82f6", padding: "4px 8px", fontSize: "12px", borderRadius: "4px" }}
            >
              + Ajouter une évaluation
            </button>
          </div>

          {coursePlan.exams.length === 0 && (
            <div style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>
              Ajoutez au moins une évaluation (contrôle, examen, projet).
            </div>
          )}

          {coursePlan.exams.map((ex, i) => (
            <div key={ex.id} style={{ marginTop: "12px", padding: "12px", border: "1px dashed #ddd", borderRadius: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>Évaluation #{i + 1}</strong>
                <button
                  onClick={() => removeExam(i)}
                  style={{ background: "#ef4444", color: "white", padding: "4px 8px", fontSize: "12px", borderRadius: "4px" }}
                >
                  Supprimer
                </button>
              </div>

              <div className="word-label" style={{ marginTop: "8px" }}>Titre :</div>
              <input
                className="word-input"
                value={ex.title}
                placeholder="Ex: Examen final"
                onChange={(e) => updateExam(i, "title", e.target.value)}
              />

              <div className="word-label">Date (YYYY-MM-DD) :</div>
              <input
                className="word-input"
                value={ex.date}
                placeholder="Ex: 2025-12-18"
                onChange={(e) => updateExam(i, "date", e.target.value)}
              />

              <div className="word-label">Matière couverte :</div>
              <textarea
                className="desc-fixed"
                style={{ minHeight: "60px" }}
                value={ex.coverage}
                placeholder="Chapitres, compétences, thématiques évaluées."
                onChange={(e) => updateExam(i, "coverage", e.target.value)}
              />
            </div>
          ))}
        </div>

        {/* Règles IA visibles */}
        <div style={{ marginBottom: "20px", padding: "15px", border: "1px solid #eee", borderRadius: "8px", background: "#fafafa" }}>
          <strong>Règles de validation IA</strong>
          <ul style={{ marginTop: "8px" }}>
            {coursePlan.questions.map(q => (
              <li key={q.id} style={{ fontSize: "12px", marginBottom: "6px" }}>
                <strong>{q.label}:</strong> {q.rule}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ marginTop: "20px" }}>
          <button className="btn-primary" onClick={saveForm}>
            {activeFormId ? "Mettre à jour le modèle" : "Sauvegarder et activer le nouveau modèle"}
          </button>
          {activeFormId && (
            <button
              onClick={() => { setCoursePlan(defaultCoursePlan()); setActiveFormId(null); }}
              style={{ marginLeft: '10px', background: '#ccc', color: 'black', padding: '6px 12px', borderRadius: '4px' }}
            >
              Nouveau modèle
            </button>
          )}
        </div>
      </div>

      <hr style={{ margin: '40px 0' }} />

      <div className="card">
        <h3>Modèles enregistrés ({templatesList.length})</h3>
        {templatesList.length === 0 ? (
          <p>Aucun modèle de plan de cours enregistré par votre compte.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {templatesList.map((template) => (
              <li 
                key={template.id} 
                style={{ 
                  padding: '10px 0', borderBottom: '1px solid #eee', 
                  display: 'flex', justifyContent: 'space-between', 
                  alignItems: 'center' 
                }}
              >
                <div>
                  <strong>ID: {template.id}</strong>
                  <span style={{ marginLeft: '15px', color: template.active ? 'green' : 'gray' }}>
                    ({template.active ? "ACTIF" : "Inactif"})
                  </span>
                  <div style={{ fontSize: '12px', color: '#666' }}>
  {
    (() => {
      const ts = template.createdAt;
      let dateStr = "Date inconnue";
      try {
        if (ts?.toDate) {
          dateStr = ts.toDate().toLocaleDateString();
        } else if (typeof ts === "string" || ts instanceof Date) {
          dateStr = new Date(ts).toLocaleDateString();
        }
      } catch {}
      return <>Créé le: {dateStr}</>;
    })()
  }
  {template.creatorId && <span style={{ marginLeft: '10px', fontWeight: 'bold' }}> (Créateur: {template.creatorId.substring(0, 5)}...)</span>}
  {template.type && <span style={{ marginLeft: '10px' }}>Type: {template.type}</span>}
</div>
                </div>
                <div>
                  <button 
                    onClick={() => editTemplate(template)} 
                    style={{ background: '#3b82f6', color: 'white', marginRight: '10px', padding: '6px 12px', borderRadius: '4px' }}
                  >
                    Modifier
                  </button>
                  <button 
                    onClick={() => deleteTemplate(template.id)} 
                    style={{ background: '#ef4444', color: 'white', padding: '6px 12px', borderRadius: '4px' }}
                  >
                    Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
