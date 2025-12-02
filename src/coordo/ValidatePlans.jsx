import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
  query, // <--- AJOUTÉ
  orderBy, // <--- AJOUTÉ
} from "firebase/firestore";

export default function ValidatePlans() {
  // Data
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);

  // Comment
  const [comment, setComment] = useState("");
  const [isEditingComment, setIsEditingComment] = useState(false);

  // AI
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  // Filters
  const [filterTeacher, setFilterTeacher] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSession, setFilterSession] = useState("");

  const teacherOptions = Array.from(
    new Set(plans.map((p) => p.teacherName).filter(Boolean))
  );
  const statusOptions = Array.from(
    new Set(plans.map((p) => p.status).filter(Boolean))
  );
  const sessionOptions = Array.from(
    new Set(plans.map((p) => p.session).filter(Boolean))
  );

  const filteredPlans = plans.filter(
    (p) =>
      (!filterTeacher || p.teacherName === filterTeacher) &&
      (!filterStatus || p.status === filterStatus) &&
      (!filterSession || String(p.session) === String(filterSession))
  );

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    // ⭐ MODIFICATION : Ajout du tri par date de création descendante (plus récent en haut)
    const q = query(
      collection(db, "coursePlans"),
      orderBy("createdAt", "desc")
    );

    const snap = await getDocs(q);

    const plansData = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data();

        // Teacher name
        let teacherName = "Inconnu";
        if (data.teacherId) {
          try {
            const userSnap = await getDoc(doc(db, "users", data.teacherId));
            if (userSnap.exists()) {
              const u = userSnap.data();
              // Gestion des cas où firstName/lastName manqueraient
              const first = u.firstName || "";
              const last = u.lastName || "";
              if (first || last) {
                teacherName = `${first} ${last}`.trim();
              } else {
                teacherName = u.email || "Enseignant";
              }
            }
          } catch (e) {
            console.error("Erreur fetch user", e);
          }
        }

        // Coordinator name
        let coordinatorName = null;
        if (data.coordinatorId) {
          try {
            const coordSnap = await getDoc(
              doc(db, "users", data.coordinatorId)
            );
            if (coordSnap.exists()) {
              const c = coordSnap.data();
              coordinatorName = [c.firstName, c.lastName]
                .filter(Boolean)
                .join(" ");
            }
          } catch (e) {
            console.error("Erreur fetch coordo", e);
          }
        }

        return { id: d.id, ...data, teacherName, coordinatorName };
      })
    );
    setPlans(plansData);
  };

  // Lazy load AI validation info when examining
  const loadAiResults = async (plan) => {
    setAiLoading(true);
    setAiError(null);
    try {
      let aiData = plan.aiValidation || null;

      if (!aiData) {
        // coursePlans/{id}/meta/aiValidation
        const aiRef = doc(db, "coursePlans", plan.id, "meta", "aiValidation");
        const aiSnap = await getDoc(aiRef);
        if (aiSnap.exists()) aiData = aiSnap.data();
      }

      setSelectedPlan({ ...plan, aiValidation: aiData });
      setComment(plan.coordinatorComment || "");
    } catch (e) {
      setAiError(e.message || String(e));
      setSelectedPlan(plan);
    } finally {
      setAiLoading(false);
    }
  };

  const getAiCommentText = (ai) => {
    if (!ai) return null;
    if (typeof ai.comment === "string" && ai.comment.trim())
      return ai.comment.trim();
    if (Array.isArray(ai.recommendations) && ai.recommendations.length) {
      return ai.recommendations.join("\n");
    }
    if (Array.isArray(ai.flags) && ai.flags.length) {
      return ai.flags
        .map((f) => `- ${f.name || "Point"}${f.detail ? `: ${f.detail}` : ""}`)
        .join("\n");
    }
    return null;
  };

  const formatTs = (ts) => {
    if (!ts) return "";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleString("fr-FR");
  };

  const handleUpdateStatus = async (status) => {
    if (!selectedPlan) return;
    try {
      const planRef = doc(db, "coursePlans", selectedPlan.id);

      await updateDoc(planRef, {
        status,
        coordinatorComment: comment || "",
        updatedAt: serverTimestamp(),
        coordinatorId: auth.currentUser?.uid || null,
        approvedAt:
          status === "Approuvé"
            ? serverTimestamp()
            : selectedPlan.approvedAt || null,
      });

      alert(`Plan marqué comme : ${status}`);
      setSelectedPlan(null);
      setComment("");
      setIsEditingComment(false);
      loadPlans();
    } catch (e) {
      console.error("Erreur updateDoc:", e);
      alert(
        "Erreur lors de la mise à jour: " +
          (e.code || "") +
          " " +
          (e.message || "")
      );
    }
  };

  return (
    <div className="card">
      <h2>Validation des plans de cours</h2>

      {!selectedPlan ? (
        <>
          {/* Filters */}
          <div
            style={{
              display: "flex",
              gap: 10,
              marginBottom: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <select
              value={filterTeacher}
              onChange={(e) => setFilterTeacher(e.target.value)}
            >
              <option value="">Tous les enseignants</option>
              {teacherOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">Tous les statuts</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              value={filterSession}
              onChange={(e) => setFilterSession(e.target.value)}
            >
              <option value="">Toutes les sessions</option>
              {sessionOptions.map((ss) => (
                <option key={ss} value={ss}>
                  {ss}
                </option>
              ))}
            </select>

            <button
              className="btn-primary"
              style={{ background: "#6b7280" }}
              onClick={() => {
                setFilterTeacher("");
                setFilterStatus("");
                setFilterSession("");
              }}
            >
              Réinitialiser
            </button>
          </div>

          {/* List */}
          <table className="word-table">
            <thead>
              <tr>
                <th>Enseignant</th>
                <th>Titre du cours</th>
                <th>Soumis le</th>
                <th>Statut</th>
                <th>Coordonnateur</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlans.map((plan) => (
                <tr key={plan.id}>
                  <td>{plan.teacherName}</td>

                  {/* ⭐ MODIFICATION : Affiche le vrai titre */}
                  <td>{plan.title || "Plan sans titre"}</td>

                  {/* Ajout colonne date soumission pour vérifier l'ordre */}
                  <td style={{ fontSize: "0.85em" }}>
                    {plan.createdAt ? formatTs(plan.createdAt) : "—"}
                  </td>

                  <td>
                    <span
                      style={{
                        fontWeight: "bold",
                        color:
                          plan.status === "Approuvé"
                            ? "green"
                            : plan.status === "Non conforme" ||
                              plan.status === "À corriger"
                            ? "red"
                            : "orange",
                      }}
                    >
                      {plan.status || "—"}
                    </span>
                  </td>

                  <td>
                    {plan.coordinatorName ||
                      (plan.status === "Approuvé" ? "—" : "")}
                  </td>

                  <td>
                    <button
                      onClick={() => loadAiResults(plan)}
                      style={{ fontSize: 14, padding: "6px 12px" }}
                    >
                      Examiner
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <div>
          <button
            onClick={() => {
              setSelectedPlan(null);
              setIsEditingComment(false);
            }}
            className="word-add"
          >
            ← Retour à la liste
          </button>

          {/* ⭐ MODIFICATION : Affiche le vrai titre dans le détail */}
          <h3>Examen du plan : {selectedPlan.title || "Plan sans titre"}</h3>

          <p>
            <strong>Enseignant :</strong> {selectedPlan.teacherName}
          </p>
          <p>
            <strong>Soumis le :</strong>{" "}
            {selectedPlan.createdAt ? formatTs(selectedPlan.createdAt) : "—"}
          </p>

          {selectedPlan.status === "Approuvé" && (
            <p>
              <strong>Approuvé par :</strong>{" "}
              {selectedPlan.coordinatorName || "Coordonnateur inconnu"}
              <br />
              <strong>Date d'approbation :</strong>{" "}
              {selectedPlan.approvedAt
                ? formatTs(selectedPlan.approvedAt)
                : "—"}
            </p>
          )}

          {/* Submitted content (example) */}
          <div
            style={{
              margin: "20px 0",
              padding: 15,
              background: "#f9f9f9",
              borderRadius: 8,
            }}
          >
            <h4>Contenu soumis :</h4>
            {/* On affiche quelques infos rapides, le reste est dans le PDF */}
            <p>
              <strong>Nombre de réponses :</strong>{" "}
              {selectedPlan.answers
                ? Object.keys(selectedPlan.answers).length
                : 0}
            </p>
            {selectedPlan.pdfUrl && (
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
            )}
          </div>

          {/* AI comments in examiner */}
          <div style={{ marginTop: 16 }}>
            <h4 style={{ marginBottom: 8 }}>Commentaires IA</h4>

            {aiLoading && <p>Chargement…</p>}
            {!aiLoading && aiError && (
              <p style={{ color: "#b91c1c" }}>Erreur: {aiError}</p>
            )}
            {!aiLoading && !aiError && (
              <>
                {(() => {
                  const aiText = getAiCommentText(selectedPlan.aiValidation);
                  return aiText ? (
                    <>
                      <div
                        style={{
                          background: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: 6,
                          padding: 12,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {aiText}
                      </div>
                      <button
                        className="btn-primary"
                        style={{ background: "#6b7280", marginTop: 8 }}
                        onClick={() => {
                          setIsEditingComment(true);
                          setComment(aiText);
                        }}
                      >
                        Copier dans le commentaire
                      </button>
                    </>
                  ) : (
                    <p>
                      Aucun commentaire IA disponible (Le plan n'a peut-être pas
                      encore été analysé ou l'analyse est ancienne).
                    </p>
                  );
                })()}
              </>
            )}
          </div>

          {/* Coordinator comment: read-only if approved unless editing */}
          <div className="input-group" style={{ marginTop: 16 }}>
            <h4>Commentaire du coordonnateur :</h4>

            {selectedPlan.status === "Approuvé" && !isEditingComment ? (
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  padding: 12,
                  whiteSpace: "pre-wrap",
                }}
              >
                {selectedPlan.coordinatorComment || "—"}
              </div>
            ) : (
              <textarea
                className="desc-fixed"
                style={{ minHeight: 100 }}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Indiquez les corrections ou le message d'approbation…"
              />
            )}

            {selectedPlan.status === "Approuvé" && (
              <div style={{ marginTop: 10 }}>
                <button
                  className="btn-primary"
                  style={{ background: "#374151" }}
                  onClick={() => {
                    if (!isEditingComment)
                      setComment(selectedPlan.coordinatorComment || "");
                    setIsEditingComment((v) => !v);
                  }}
                >
                  {isEditingComment ? "Annuler" : "Modifier"}
                </button>

                {isEditingComment && (
                  <button
                    className="btn-primary"
                    style={{ background: "#2563eb", marginLeft: 8 }}
                    onClick={() => handleUpdateStatus("Approuvé")}
                  >
                    Enregistrer
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button
              className="btn-primary"
              style={{ background: "#10b981" }}
              onClick={() => handleUpdateStatus("Approuvé")}
            >
              Approuver
            </button>

            <button
              className="btn-primary"
              style={{ background: "#f59e0b" }}
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
