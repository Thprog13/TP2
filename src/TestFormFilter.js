import React, { useState, useEffect } from "react";
// Assurez-vous d'importer db et auth du fichier firebase.js
import { db, auth } from "../firebase"; 
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
  getDoc,
  doc,
} from "firebase/firestore";

// =======================================================================
// HOOK D'AUTHENTIFICATION RÉCUPÉRÉ (Identique à ManageForms.js)
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
}
// =======================================================================
// FIN DU HOOK
// =======================================================================


export default function TestFormFilter() {
  const [testTemplates, setTestTemplates] = useState([]);
  const [filterType, setFilterType] = useState("Chargement...");
  
  const { currentUserId, userRole, isLoading } = useAuthInfo();

  // Fonction de test pour charger les données
  const runTestQuery = async () => {
    // Si pas encore chargé, on arrête
    if (isLoading || !currentUserId) {
        setFilterType("En attente de connexion...");
        return; 
    }
    
    let formsQuery;
    
    // 1. Définition de la requête en fonction du rôle
    if (userRole === 'coordonator') { 
        // 🚨 TEST DU FILTRAGE : Uniquement les documents créés par cet UID
        setFilterType(`Filtré par 'creatorId' == ${currentUserId.substring(0, 5)}...`);
        formsQuery = query(
            collection(db, "formTemplates"),
            where("creatorId", "==", currentUserId), 
            orderBy("createdAt", "desc")
        );
    } else if (userRole === 'teacher') {
        // 🚨 TEST DE L'ABSENCE DE FILTRE : Tous les documents
        setFilterType("AFFICHAGE COMPLET (Rôle 'teacher')");
        formsQuery = query(
            collection(db, "formTemplates"),
            orderBy("createdAt", "desc")
        );
    } else {
        setFilterType(`Rôle non autorisé ou manquant : ${userRole}`);
        setTestTemplates([]);
        return;
    }

    // 2. Exécution de la requête
    try {
        const snapshot = await getDocs(formsQuery);
        const loadedTemplates = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));
        setTestTemplates(loadedTemplates);
        console.log(`Requête terminée. ${loadedTemplates.length} documents chargés.`);
    } catch (error) {
        console.error("Erreur lors de l'exécution de la requête de test:", error);
        setFilterType("Erreur de requête");
    }
  };

  useEffect(() => {
    // Déclenche le test lorsque l'UID et le RÔLE sont chargés
    runTestQuery();
  }, [currentUserId, userRole, isLoading]); 

  // --- RENDU ---

  if (isLoading) {
      return <div className="card">Initialisation de l'authentification...</div>;
  }
  
  if (!currentUserId) {
       return <div className="card">Veuillez vous connecter pour exécuter le test.</div>;
  }

  return (
    <div className="card" style={{ maxWidth: '800px', margin: 'auto' }}>
      <h2>Résultat du Test de Filtrage</h2>
      
      <p style={{ fontWeight: 'bold' }}>
        UID actuel : <span style={{ color: 'blue' }}>{currentUserId}</span><br/>
        Rôle actuel : <span style={{ color: 'blue' }}>{userRole}</span>
      </p>

      <div style={{ padding: '10px', backgroundColor: '#f0f0f0', borderLeft: '5px solid orange' }}>
        **Mode de filtrage :** {filterType}
      </div>

      <h3 style={{ marginTop: '20px' }}>Documents trouvés ({testTemplates.length})</h3>
      
      {testTemplates.length === 0 && userRole !== 'teacher' ? (
        <p style={{ color: 'red', fontWeight: 'bold' }}>
          ATTENTION : La requête filtrée n'a renvoyé aucun résultat. 
          Vérifiez si l'UID ci-dessus correspond au champ 'creatorId' sur vos documents dans Firestore.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {testTemplates.map((template) => (
            <li 
              key={template.id} 
              style={{ 
                padding: '10px', 
                borderBottom: '1px dotted #ccc',
                backgroundColor: template.creatorId === currentUserId ? '#e6ffe6' : 'inherit'
              }}
            >
              ID: **{template.id.substring(0, 8)}...** <br/>
              Creator ID Stocké: **{template.creatorId.substring(0, 5)}...** {template.creatorId === currentUserId && <span style={{ color: 'green', marginLeft: '10px' }}> (✅ MATCH)</span>}
              {template.creatorId !== currentUserId && <span style={{ color: 'red', marginLeft: '10px' }}> (❌ NO MATCH)</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}