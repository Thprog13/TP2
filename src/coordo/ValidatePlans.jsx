import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  getDoc,
} from "firebase/firestore";

// Vérifiez bien que cette ligne est présente :
export default function ValidatePlans() {
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [comment, setComment] = useState("");

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    const snap = await getDocs(collection(db, "coursePlans"));
    const plansData = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data();
        // Récupérer le nom de l'enseignant pour l'affichage
        let teacherName = "Inconnu";
        if (data.teacherId) {
          const userSnap = await getDoc(doc(db, "users", data.teacherId));
          if (userSnap.exists()) {
            teacherName = `${userSnap.data().firstName} ${
              userSnap.data().lastName
            }`;
          }
        }
        return { id: d.id, ...data, teacherName };
      })
    );
    setPlans(plansData);
  };

  const handleUpdateStatus = async (status) => {
    if (!selectedPlan) return;

    try {
      await updateDoc(doc(db, "coursePlans", selectedPlan.id), {
        status: status,
        coordinatorComment: comment,
      });
      alert(`Plan marqué comme : ${status}`);
      setSelectedPlan(null);
      setComment("");
      loadPlans();
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la mise à jour.");
    }
  };

  return (
    <div className="card">
      <h2>Validation des plans de cours</h2>

      {!selectedPlan ? (
        <table className="word-table">
          <thead>
            <tr>
              <th>Enseignant</th>
              <th>Titre du cours</th>
              <th>Statut</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id}>
                <td>{plan.teacherName}</td>
                <td>{plan.answers?.[1764218126528] || "Sans titre"}</td>
                <td>{plan.status}</td>
                <td>
                  <button
                    onClick={() => setSelectedPlan(plan)}
                    style={{ fontSize: "14px", padding: "6px 12px" }}
                  >
                    Examiner
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div>
          <button onClick={() => setSelectedPlan(null)} className="word-add">
            ← Retour à la liste
          </button>

          <h3>Examen du plan : {selectedPlan.answers?.[1764218126528]}</h3>
          <p>
            <strong>Enseignant :</strong> {selectedPlan.teacherName}
          </p>

          <div
            style={{
              margin: "20px 0",
              padding: "15px",
              background: "#f9f9f9",
              borderRadius: "8px",
            }}
          >
            <h4>Contenu soumis :</h4>
            <p>
              <strong>Description :</strong> {selectedPlan.answers?.description}
            </p>

            <p>
              <a
                href={selectedPlan.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-link"
              >
                Voir le PDF complet
              </a>
            </p>
          </div>

          <div className="input-group">
            <label>Commentaire du coordonnateur :</label>
            <textarea
              className="desc-fixed"
              style={{ minHeight: "100px" }}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Indiquez les corrections demandées ou un message d'approbation..."
            />
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
            <button
              className="btn-primary"
              style={{ background: "#10b981", marginTop: 0 }}
              onClick={() => handleUpdateStatus("Approuvé")}
            >
              Approuver
            </button>

            <button
              className="btn-primary"
              style={{ background: "#f59e0b", marginTop: 0 }}
              onClick={() => handleUpdateStatus("À corriger")}
            >
              Demander correction
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
