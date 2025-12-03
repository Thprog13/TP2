import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";

export default function ValidatePlans() {
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [comment, setComment] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [filterTeacher, setFilterTeacher] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const loadPlans = async () => {
    const q = query(
      collection(db, "coursePlans"),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    const plansData = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data();
        let teacherName = "Inconnu";
        if (data.teacherId) {
          try {
            const userSnap = await getDoc(doc(db, "users", data.teacherId));
            if (userSnap.exists()) {
              const u = userSnap.data();
              teacherName = u.firstName
                ? `${u.firstName} ${u.lastName}`
                : u.email;
            }
          } catch (e) { console.error("erreur récupération plan", e); }
        }
        return { id: d.id, ...data, teacherName };
      })
    );
    setPlans(plansData);
  };

  useEffect(() => {
    const run = async () => {
      await loadPlans();
    };
  run();
  }, []);

  const teacherOptions = Array.from(
    new Set(plans.map((p) => p.teacherName).filter(Boolean))
  );
  const statusOptions = Array.from(
    new Set(plans.map((p) => p.status).filter(Boolean))
  );
  const filteredPlans = plans.filter(
    (p) =>
      (!filterTeacher || p.teacherName === filterTeacher) &&
      (!filterStatus || p.status === filterStatus)
  );

  // Compteurs par statut (basés sur les plans filtrés). Normaliser les statuts
  // (trim + lowercase) pour éviter les problèmes de casse / espaces / accents.
  const normalize = (s) => (s || "").toString().trim().toLowerCase();
  const countSubmitted = filteredPlans.filter((p) => normalize(p.status) === "soumis").length;
  const countToCorrect = filteredPlans.filter((p) => normalize(p.status) === "à corriger").length;
  const countApproved = filteredPlans.filter((p) => normalize(p.status) === "approuvé").length;

  const loadAiResults = async (plan) => {
    setAiLoading(true);
    try {
      let aiData = plan.aiValidation || null;
      if (!aiData) {
        const aiRef = doc(db, "coursePlans", plan.id, "meta", "aiValidation");
        const aiSnap = await getDoc(aiRef);
        if (aiSnap.exists()) aiData = aiSnap.data();
      }
      setSelectedPlan({ ...plan, aiValidation: aiData });
      setComment(plan.coordinatorComment || "");
    } catch (e) {
      console.error("erreur récupération AI", e);
      setSelectedPlan(plan);
    }
    setAiLoading(false);
  };

  const handleUpdateStatus = async (status) => {
    await updateDoc(doc(db, "coursePlans", selectedPlan.id), {
      status,
      coordinatorComment: comment,
      updatedAt: serverTimestamp(),
      coordinatorId: auth.currentUser?.uid,
      approvedAt: status === "Approuvé" ? serverTimestamp() : null,
    });
    alert(`Plan marqué comme : ${status}`);
    setSelectedPlan(null);
    loadPlans();
  };

  const getAiCommentText = (ai) => {
    if (!ai) return null;
    if (ai.recommendations?.length) return ai.recommendations.join("\n");
    return null;
  };

  return (
    <div className="h-full flex flex-col max-w-6xl mx-auto">
      {!selectedPlan ? (
        <div className="card-modern">
          <h2 className="text-2xl font-bold text-white mb-6">
            Validation des plans
          </h2>

          <div className="flex gap-4 mb-6 flex-wrap">
            <select
              className="input-modern max-w-xs"
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
              className="input-modern max-w-xs"
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
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-left text-sm text-slate-400">
              <thead className="bg-slate-900 text-slate-200 uppercase font-medium">
                <tr>
                  <th className="px-6 py-4">Enseignant</th>
                  <th className="px-6 py-4">Cours</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Statut</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredPlans.map((plan) => (
                  <tr
                    key={plan.id}
                    className="hover:bg-slate-700/30 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-white">
                      {plan.teacherName}
                    </td>
                    <td className="px-6 py-4">{plan.title || "Sans titre"}</td>
                    <td className="px-6 py-4">
                      {plan.createdAt
                        ? new Date(plan.createdAt.toDate()).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          plan.status === "Approuvé"
                            ? "bg-green-900 text-green-400"
                            : "bg-orange-900 text-orange-400"
                        }`}
                      >
                        {plan.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => loadAiResults(plan)}
                        className="text-blue-400 hover:text-blue-300 font-medium"
                      >
                        Examiner →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700 text-center">
              <div className="text-xs text-slate-400">Soumis</div>
              <div className="text-2xl font-bold text-yellow-300">{countSubmitted}</div>
            </div>

            <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700 text-center">
              <div className="text-xs text-slate-400">À corriger</div>
              <div className="text-2xl font-bold text-orange-300">{countToCorrect}</div>
            </div>

            <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700 text-center">
              <div className="text-xs text-slate-400">Approuvé</div>
              <div className="text-2xl font-bold text-green-300">{countApproved}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card-modern space-y-6">
          <button
            onClick={() => setSelectedPlan(null)}
            className="mb-4 text-slate-400 hover:text-white flex items-center gap-2"
          >
            ← Retour
          </button>
          <div className="flex justify-between items-start border-b border-slate-700 pb-6 mb-6">
            <div>
              <h2 className="text-3xl font-bold text-white">
                {selectedPlan.title}
              </h2>
              <p className="text-slate-400 mt-1">
                Enseignant :{" "}
                <span className="text-white">{selectedPlan.teacherName}</span>
              </p>
            </div>
            <a
              href={selectedPlan.pdfUrl}
              target="_blank"
              className="btn-primary"
            >
              Voir le PDF
            </a>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700">
              <h3 className="text-lg font-bold text-purple-400 mb-4">
                Analyse IA
              </h3>
              {aiLoading ? (
                <p>Chargement...</p>
              ) : (
                <div className="text-slate-300 text-sm space-y-2 whitespace-pre-wrap">
                  {getAiCommentText(selectedPlan.aiValidation) ||
                    "Pas de données IA disponibles."}
                </div>
              )}
            </div>
            <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-4">Validation</h3>
              <textarea
                className="input-modern min-h-[150px] mb-4"
                placeholder="Commentaire..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => handleUpdateStatus("Approuvé")}
                  className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2 rounded-lg font-bold"
                >
                  Approuver
                </button>
                <button
                  onClick={() => handleUpdateStatus("À corriger")}
                  className="flex-1 bg-orange-600 hover:bg-orange-500 text-white py-2 rounded-lg font-bold"
                >
                  Demander correction
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
