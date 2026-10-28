import { useState } from "react";
import PageHeader from "../components/PageHeader.jsx";
import DataState from "../components/DataState.jsx";
import Pagination from "../components/Pagination.jsx";
import Field from "../components/Field.jsx";
import PaiementFormModal from "../components/PaiementFormModal.jsx";
import { Badge } from "../components/Badge.jsx";
import usePaginated from "../hooks/usePaginated.js";
import useDebounce from "../hooks/useDebounce.js";
import { paiementsApi } from "../services/resources.js";
import { MODES, TYPES_PAIEMENT, formatDateHeure, formatMontant, nettoyerParams } from "../utils/format.js";

export default function PaiementsPage() {
  const [filtres, setFiltres] = useState({ search: "", type: "", mode: "", date_debut: "", date_fin: "" });
  const recherche = useDebounce(filtres.search);
  const liste = usePaginated(paiementsApi.list, nettoyerParams({ ...filtres, search: recherche }));
  const [ouvert, setOuvert] = useState(false);
  const set = (k) => (e) => setFiltres({ ...filtres, [k]: e.target.value });

  return (
    <>
      <PageHeader title="Paiements" subtitle="Historique des encaissements et remboursements (saisie manuelle)"
        actions={<button className="btn btn-primary" onClick={() => setOuvert(true)}>+ Nouveau mouvement</button>} />
      <div className="card filters">
        <Field label="Recherche"><input placeholder="Référence, client…" value={filtres.search} onChange={set("search")} /></Field>
        <Field label="Type"><select value={filtres.type} onChange={set("type")}>
          <option value="">Tous</option>{Object.entries(TYPES_PAIEMENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Mode"><select value={filtres.mode} onChange={set("mode")}>
          <option value="">Tous</option>{Object.entries(MODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Du"><input type="date" value={filtres.date_debut} onChange={set("date_debut")} /></Field>
        <Field label="Au"><input type="date" value={filtres.date_fin} min={filtres.date_debut} onChange={set("date_fin")} /></Field>
      </div>
      <div className="card">
        <DataState loading={liste.loading} error={liste.error} empty={liste.results.length === 0} emptyText="Aucun paiement enregistré.">
          <div className="table-wrap"><table>
            <thead><tr><th>Date</th><th>Réservation</th><th>Type</th><th>Mode</th><th>Montant</th><th>Référence</th><th>Par</th></tr></thead>
            <tbody>{liste.results.map((p) => (
              <tr key={p.id}>
                <td>{formatDateHeure(p.date_paiement)}</td><td>{p.reservation_label}</td>
                <td><Badge tone={p.type === "PAIEMENT" ? "green" : "red"}>{TYPES_PAIEMENT[p.type]}</Badge></td>
                <td>{MODES[p.mode]}</td>
                <td>{p.type === "REMBOURSEMENT" ? "−" : ""}{formatMontant(p.montant)}</td>
                <td>{p.reference || "—"}</td><td>{p.enregistre_par_nom || "—"}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </DataState>
        <Pagination count={liste.count} page={liste.page} onChange={liste.setPage} />
      </div>
      {ouvert && <PaiementFormModal onClose={() => setOuvert(false)} onSaved={() => { setOuvert(false); liste.reload(); }} />}
    </>
  );
}
