import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader.jsx";
import DataState from "../components/DataState.jsx";
import Field from "../components/Field.jsx";
import { StatutBadge } from "../components/Badge.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { rapportsApi } from "../services/resources.js";
import { telecharger } from "../services/api.js";
import { MODES, STATUTS, TYPES_PAIEMENT, aujourdhui, formatDate, formatDateHeure, formatMontant, nettoyerParams } from "../utils/format.js";

const ONGLETS = [["reservations", "Réservations"], ["paiements", "Paiements"], ["revenus", "Synthèse des revenus"]];

function debutDuMois() {
  return `${aujourdhui().slice(0, 8)}01`;
}

export default function RapportsPage() {
  const notify = useToast();
  const [onglet, setOnglet] = useState("reservations");
  const [filtres, setFiltres] = useState({ date_debut: debutDuMois(), date_fin: aujourdhui(), statut: "" });
  const [etat, setEtat] = useState({ loading: true, error: "", data: null });
  const params = nettoyerParams({ ...filtres, statut: onglet === "reservations" ? filtres.statut : "" });

  useEffect(() => {
    let actif = true;
    setEtat((e) => ({ ...e, loading: true }));
    rapportsApi[onglet](params)
      .then((data) => actif && setEtat({ loading: false, error: "", data }))
      .catch((e) => actif && setEtat({ loading: false, error: e.message, data: null }));
    return () => { actif = false; };
  }, [onglet, JSON.stringify(params)]); // eslint-disable-line react-hooks/exhaustive-deps

  async function exporter() {
    try {
      telecharger(await rapportsApi.exportCsv(onglet, params), `${onglet}.csv`);
    } catch (err) {
      notify.error(err.message);
    }
  }

  const set = (k) => (e) => setFiltres({ ...filtres, [k]: e.target.value });
  const d = etat.data;
  return (
    <>
      <PageHeader title="Rapports" subtitle="Réservations, paiements et revenus sur une période"
        actions={onglet !== "revenus" && <button className="btn btn-light" onClick={exporter}>Exporter en CSV</button>} />
      <div className="tabs">
        {ONGLETS.map(([cle, label]) => (
          <button key={cle} className={`tab ${onglet === cle ? "active" : ""}`} onClick={() => setOnglet(cle)}>{label}</button>
        ))}
      </div>
      <div className="card filters">
        <Field label="Du"><input type="date" value={filtres.date_debut} max={filtres.date_fin} onChange={set("date_debut")} /></Field>
        <Field label="Au"><input type="date" value={filtres.date_fin} min={filtres.date_debut} onChange={set("date_fin")} /></Field>
        {onglet === "reservations" && (
          <Field label="Statut"><select value={filtres.statut} onChange={set("statut")}>
            <option value="">Tous</option>{Object.entries(STATUTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        )}
      </div>
      <div className="card">
        <DataState loading={etat.loading} error={etat.error} empty={Array.isArray(d) && d.length === 0} emptyText="Aucune donnée sur cette période.">
          {onglet === "reservations" && Array.isArray(d) && (
            <div className="table-wrap"><table>
              <thead><tr><th>N°</th><th>Client</th><th>Ch.</th><th>Séjour</th><th>Total</th><th>Payé</th><th>Solde</th><th>Statut</th></tr></thead>
              <tbody>{d.map((r) => (
                <tr key={r.id}><td>#{r.id}</td><td>{r.client_nom}</td><td>{r.chambre_numero}</td>
                  <td>{formatDate(r.date_arrivee)} → {formatDate(r.date_depart)}</td><td>{formatMontant(r.prix_total)}</td>
                  <td>{formatMontant(r.montant_paye)}</td><td>{formatMontant(r.solde)}</td>
                  <td><StatutBadge statut={r.statut} libelle={r.statut_libelle} /></td></tr>
              ))}</tbody>
            </table></div>
          )}
          {onglet === "paiements" && Array.isArray(d) && (
            <div className="table-wrap"><table>
              <thead><tr><th>Date</th><th>Réservation</th><th>Type</th><th>Mode</th><th>Montant</th><th>Référence</th></tr></thead>
              <tbody>{d.map((p) => (
                <tr key={p.id}><td>{formatDateHeure(p.date_paiement)}</td><td>{p.reservation_label}</td>
                  <td>{TYPES_PAIEMENT[p.type]}</td><td>{MODES[p.mode]}</td><td>{formatMontant(p.montant)}</td><td>{p.reference || "—"}</td></tr>
              ))}</tbody>
            </table></div>
          )}
          {onglet === "revenus" && d && !Array.isArray(d) && (
            <>
              <div className="stat-grid">
                <div className="card stat"><span className="muted small">Encaissé (brut)</span><strong>{formatMontant(d.encaisse_brut)}</strong></div>
                <div className="card stat"><span className="muted small">Remboursé</span><strong>{formatMontant(d.rembourse)}</strong></div>
                <div className="card stat highlight"><span className="muted small">Revenus encaissés nets</span><strong>{formatMontant(d.revenus_encaisses_nets)}</strong></div>
                <div className="card stat"><span className="muted small">CA prévisionnel (arrivées de la période)</span><strong>{formatMontant(d.chiffre_affaires_previsionnel)}</strong></div>
                <div className="card stat"><span className="muted small">Reste à encaisser</span><strong>{formatMontant(d.reste_a_encaisser)}</strong></div>
              </div>
              <p className="muted small">Le prévisionnel correspond aux réservations non annulées dont l'arrivée tombe dans la période ; il ne représente pas de l'argent déjà reçu.</p>
              <h3>Encaissements nets par mode de paiement</h3>
              <div className="table-wrap"><table>
                <thead><tr><th>Mode</th><th>Net</th></tr></thead>
                <tbody>{d.par_mode.length === 0 ? <tr><td colSpan="2">Aucun mouvement.</td></tr> :
                  d.par_mode.map((m) => <tr key={m.mode}><td>{MODES[m.mode]}</td><td>{formatMontant(m.net)}</td></tr>)}</tbody>
              </table></div>
            </>
          )}
        </DataState>
      </div>
    </>
  );
}
