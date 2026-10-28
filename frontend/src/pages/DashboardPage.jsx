import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import PageHeader from "../components/PageHeader.jsx";
import DataState from "../components/DataState.jsx";
import { StatutBadge } from "../components/Badge.jsx";
import Field from "../components/Field.jsx";
import { rapportsApi } from "../services/resources.js";
import { aujourdhui, formatDate, formatMontant } from "../utils/format.js";

const COULEURS = { EN_ATTENTE: "#f59e0b", CONFIRMEE: "#2563eb", ANNULEE: "#9ca3af", TERMINEE: "#16a34a" };

function jourMoins(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DashboardPage() {
  const [periode, setPeriode] = useState({ date_debut: jourMoins(29), date_fin: aujourdhui() });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let actif = true;
    setLoading(true);
    rapportsApi.dashboard(periode)
      .then((d) => actif && (setData(d), setError("")))
      .catch((e) => actif && setError(e.message))
      .finally(() => actif && setLoading(false));
    return () => { actif = false; };
  }, [periode]);

  const cartes = data && [
    ["Chambres", data.total_chambres],
    ["Disponibles", data.chambres_disponibles],
    ["Occupées", data.chambres_occupees],
    ["Réservations en attente", data.reservations_en_attente],
    ["Réservations confirmées", data.reservations_confirmees],
    ["Clients", data.total_clients],
    ["Revenus encaissés", formatMontant(data.revenus_encaisses)],
  ];

  return (
    <>
      <PageHeader title="Tableau de bord" subtitle="Indicateurs calculés en temps réel depuis la base de données" />
      <div className="card filters">
        <Field label="Revenus du"><input type="date" value={periode.date_debut} max={periode.date_fin}
          onChange={(e) => setPeriode({ ...periode, date_debut: e.target.value })} /></Field>
        <Field label="au"><input type="date" value={periode.date_fin} min={periode.date_debut}
          onChange={(e) => setPeriode({ ...periode, date_fin: e.target.value })} /></Field>
      </div>
      <DataState loading={loading && !data} error={error}>
        {data && (
          <>
            <div className="stat-grid">
              {cartes.map(([label, valeur]) => (
                <div className="card stat" key={label}><span className="muted small">{label}</span><strong>{valeur}</strong></div>
              ))}
            </div>
            <div className="grid-2">
              <div className="card">
                <h3>Revenus encaissés par jour</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.revenus_par_jour.map((r) => ({ ...r, montant: Number(r.montant) }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} minTickGap={20} />
                    <YAxis tickFormatter={(v) => new Intl.NumberFormat("fr-FR", { notation: "compact" }).format(v)} />
                    <Tooltip formatter={(v) => formatMontant(v)} labelFormatter={formatDate} />
                    <Bar dataKey="montant" name="Encaissé" fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="card">
                <h3>Réservations par statut</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={data.reservations_par_statut.filter((s) => s.total > 0)} dataKey="total" nameKey="libelle" label>
                      {data.reservations_par_statut.filter((s) => s.total > 0).map((s) => (
                        <Cell key={s.statut} fill={COULEURS[s.statut]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card">
              <h3>Dernières réservations</h3>
              <DataState empty={data.dernieres_reservations.length === 0} emptyText="Aucune réservation pour le moment.">
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>N°</th><th>Client</th><th>Chambre</th><th>Séjour</th><th>Total</th><th>Statut</th></tr></thead>
                    <tbody>
                      {data.dernieres_reservations.map((r) => (
                        <tr key={r.id}>
                          <td>#{r.id}</td><td>{r.client_nom}</td><td>{r.chambre_numero}</td>
                          <td>{formatDate(r.date_arrivee)} → {formatDate(r.date_depart)}</td>
                          <td>{formatMontant(r.prix_total)}</td>
                          <td><StatutBadge statut={r.statut} libelle={r.statut_libelle || r.statut} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DataState>
            </div>
          </>
        )}
      </DataState>
    </>
  );
}
