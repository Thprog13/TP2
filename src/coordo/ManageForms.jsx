import React, { useState, useEffect } from "react";
// Assurez-vous d'importer db et auth du fichier firebase.js
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
  getDoc, // Ajouté pour useAuthInfo
} from "firebase/firestore";

// =======================================================================
// 1. HOOK D'AUTHENTIFICATION RÉEL (Lit l'UID et le rôle dans Firestore)
// =======================================================================
const useAuthInfo = () => {
    const [authInfo, setAuthInfo] = useState({ currentUserId: null, userRole: null });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Écoute les changements d'état d'authentification de Firebase
        const unsubscribe = auth.onAuthStateChanged(async user => {
            if (user) {
                try {
                    // Lecture du document 'users' pour obtenir le rôle
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
                // Utilisateur déconnecté
                setAuthInfo({ currentUserId: null, userRole: null });
            }
            setIsLoading(false); // Le chargement est terminé, qu'il y ait un rôle ou non
        });
        return unsubscribe;
    }, []);

    return { ...authInfo, isLoading };
}
// =======================================================================
// FIN DU HOOK
// =======================================================================


export default function ManageForms() {
  const [questions, setQuestions] = useState([]);
  const [activeFormId, setActiveFormId] = useState(null);
  const [templatesList, setTemplatesList] = useState([]);
  
  // 2. Récupération des informations d'authentification
  const { currentUserId, userRole, isLoading } = useAuthInfo();

  // Fonction pour charger la liste complète des modèles et le modèle actif
  const loadForms = async () => {
    // On n'exécute la requête QUE si tout est chargé et valide
    if (isLoading || !currentUserId || !userRole) {
        return; 
    }
    
    let formsQuery;
    
    // 🚨 FILTRE : Basé sur le rôle 'coordonator'
    if (userRole === 'coordonator') { 
        // Le Coordonateur voit CE QU'IL A CRÉÉ
        formsQuery = query(
            collection(db, "formTemplates"),
            where("creatorId", "==", currentUserId), 
            orderBy("createdAt", "desc")
        );
    } else {
        // L'ENSEIGNANT voit TOUS les modèles
        formsQuery = query(
            collection(db, "formTemplates"),
            orderBy("createdAt", "desc")
        );
    }

    const allSnap = await getDocs(formsQuery);
    const loadedTemplates = allSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    setTemplatesList(loadedTemplates);
    
    // Charger le modèle actif ou le plus récent trouvé dans la liste filtrée
    const activeForm = loadedTemplates.length > 0 ? loadedTemplates[0] : null;

    if (activeForm) {
      setQuestions(activeForm.questions || []);
      setActiveFormId(activeForm.id);
    } else {
      setQuestions([]);
      setActiveFormId(null);
    }
  };

  useEffect(() => {
    // Déclenche le chargement lorsque l'UID et le RÔLE sont chargés
    loadForms();
  }, [currentUserId, userRole, isLoading]); 

  // --- Fonctions CRUD (Inchangées) ---
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

  const deleteTemplate = async (templateId) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce modèle ?")) return;
    
    // 🚨 VÉRIFICATION DES DROITS CORRIGÉE
    if (userRole !== 'coordonator' && userRole !== 'teacher') return alert("Action non autorisée."); 

    try {
      await deleteDoc(doc(db, "formTemplates", templateId));
      setTemplatesList(templatesList.filter(t => t.id !== templateId)); 
      if (activeFormId === templateId) { setQuestions([]); setActiveFormId(null); }
      alert("Modèle supprimé avec succès !");
    } catch (e) {
      console.error("Erreur de suppression:", e);
      alert("Erreur lors de la suppression du modèle.");
    }
  };

  const editTemplate = (template) => {
    setQuestions(template.questions || []);
    setActiveFormId(template.id);
    window.scrollTo(0, 0); 
    alert(`Modèle '${template.id}' chargé pour modification.`);
  };


  const saveForm = async () => {
    if (questions.length === 0) return alert("Ajoutez au moins une question.");
    if (!currentUserId) return alert("Erreur d'authentification. Veuillez vous reconnecter.");
    
    try {
      if (activeFormId) {
        const formRef = doc(db, "formTemplates", activeFormId);
        await updateDoc(formRef, { questions, updatedAt: new Date(), });
        loadForms(); 
        alert("Formulaire mis à jour !");
      } else {
        const newDoc = await addDoc(collection(db, "formTemplates"), {
          questions,
          createdAt: new Date(),
          active: true,
          creatorId: currentUserId, // ENREGISTREMENT DE L'ID DU CRÉATEUR
        });
        setActiveFormId(newDoc.id); 
        loadForms(); 
        alert("Nouveau formulaire sauvegardé et activé !");
      }
    } catch (e) {
      console.error("Error saving form:", e);
      alert("Erreur lors de la sauvegarde.");
    }
  };
  
  // ==================================================
  // 3. GESTION DE L'ÉTAT ET DES ACCÈS AU RENDU
  // ==================================================
  if (isLoading) {
      // 1. Attendre que le hook useAuthInfo ait terminé toutes ses opérations
      return <div className="card">Chargement des permissions...</div>;
  }

  if (!currentUserId) {
      // 2. Utilisateur non connecté
       return <div className="card">Veuillez vous connecter pour gérer les formulaires.</div>;
  }

  // 3. Si l'utilisateur est connecté mais que le champ 'role' est manquant dans Firestore
  if (!userRole) {
      return (
          <div className="card">
              Accès refusé. Votre compte est connecté (UID: {currentUserId.substring(0, 5)}...), mais le rôle n'a pas pu être chargé depuis la base de données.
              <br/><br/>
              **Vérification requise :** Assurez-vous que le document de cet utilisateur dans la collection **"users"** contient le champ **"role"**.
          </div>
      );
  }

  // 4. VÉRIFICATION FINALE DES DROITS
  if (userRole !== 'coordonator' && userRole !== 'teacher') {
       return <div className="card">Accès refusé. Votre rôle ({userRole}) n'a pas les droits de gestion (seuls 'coordonator' et 'teacher' sont autorisés).</div>;
  }
  // ==================================================
  // FIN GESTION DE L'ÉTAT
  // ==================================================

  // --- RENDU NORMAL ---
  return (
    <div>
      
      <div className="card">
        <h2>{activeFormId ? `Édition du modèle (${activeFormId})` : "Créer un nouveau modèle de formulaire"}</h2>
        <p>Définissez les questions et les règles de validation pour l'IA.</p>

        {questions.map((q, i) => (
          <div
            key={q.id}
            style={{ marginBottom: "20px", padding: "15px", border: "1px solid #ddd", borderRadius: "8px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>Question #{i + 1}</strong>
              <button
                onClick={() => deleteQuestion(i)}
                style={{ background: "#ef4444", color: "white", padding: "4px 8px", fontSize: "12px" }}
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
          style={{ background: "none", border: "none", fontSize: "16px", marginTop: "10px" }}
        >
          + Ajouter une question
        </button>

        <div style={{ marginTop: "30px" }}>
          <button className="btn-primary" onClick={saveForm}>
            {activeFormId ? "Mettre à jour le modèle" : "Sauvegarder et activer le nouveau modèle"}
          </button>
          {activeFormId && (
              <button 
                  onClick={() => { setQuestions([]); setActiveFormId(null); }}
                  style={{ marginLeft: '10px', background: '#ccc', color: 'black' }}
              >
                  Nouveau modèle
              </button>
          )}
        </div>
      </div>
      
      <hr style={{ margin: '40px 0' }} />

      <div className="card">
        <h3>Modèles de formulaires enregistrés ({templatesList.length})</h3>
        
        {templatesList.length === 0 ? (
          <p>Aucun modèle de formulaire enregistré par votre compte.</p>
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
                    Créé le: {new Date(template.createdAt?.toDate ? template.createdAt.toDate() : template.createdAt).toLocaleDateString()}
                    {template.creatorId && <span style={{ marginLeft: '10px', fontWeight: 'bold' }}> (Créateur: {template.creatorId.substring(0, 5)}...)</span>}
                  </div>
                </div>
                <div>
                  <button 
                    onClick={() => editTemplate(template)} 
                    style={{ background: '#3b82f6', color: 'white', marginRight: '10px', padding: '6px 12px' }}
                  >
                    Modifier
                  </button>
                  <button 
                    onClick={() => deleteTemplate(template.id)} 
                    style={{ background: '#ef4444', color: 'white', padding: '6px 12px' }}
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