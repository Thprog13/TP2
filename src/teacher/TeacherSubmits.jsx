import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

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

export default function TeacherSubmits() {
  const [submits, setSubmits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        // Requête simple SANS orderBy serveur pour éviter l'erreur d'index
        const q = query(
          collection(db, "coursePlans"),
          where("teacherId", "==", user.uid)
        );

        const snap = await getDocs(q);

        let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Tri Javascript (Descendant par date de création)
        rows.sort((a, b) => {
          const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return tb - ta;
        });

        setSubmits(rows);
      } catch (error) {
        console.error("Erreur chargement remises:", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="text-white p-6">Chargement...</div>;

  return (
    <div className="card-modern">
      <h2 className="text-2xl font-bold text-white mb-6">
        Historique des remises
      </h2>
      {submits.length === 0 ? (
        <p className="text-dark-muted text-center">Aucune remise trouvée.</p>
      ) : (
        <div className="grid gap-4">
          {submits.map((plan) => (
            <div
              key={plan.id}
              className="bg-dark-bg p-4 rounded-xl border border-dark-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
            >
              <div>
                <h3 className="font-bold text-white text-lg">
                  {plan.title || "Sans titre"}
                </h3>

                <div className="flex flex-col gap-1 mt-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded inline-block ${
                        plan.status === "Approuvé"
                          ? "text-green-400 bg-green-900/20"
                          : plan.status === "À corriger"
                          ? "text-red-400 bg-red-900/20"
                          : "text-yellow-400 bg-yellow-900/20"
                      }`}
                    >
                      {plan.status || "Soumis"}
                    </span>
                    <span className="text-xs text-dark-muted">
                      | {formatDateTime(plan.createdAt)}
                    </span>
                  </div>

                  {plan.coordinatorComment && (
                    <div className="mt-2 text-sm text-slate-300 bg-slate-800/50 p-2 rounded border border-slate-700">
                      <span className="font-bold text-slate-400 text-xs uppercase block mb-1">
                        Feedback du coordonnateur :
                      </span>
                      {plan.coordinatorComment}
                    </div>
                  )}
                </div>
              </div>

              {plan.pdfUrl && (
                <a
                  href={plan.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm bg-dark-card border border-dark-border px-4 py-2 rounded hover:bg-slate-700 transition-colors text-white whitespace-nowrap"
                >
                  Voir PDF
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
