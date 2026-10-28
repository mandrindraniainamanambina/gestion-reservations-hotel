import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader.jsx";
import DataState from "../components/DataState.jsx";
import Pagination from "../components/Pagination.jsx";
import Modal from "../components/Modal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import Field from "../components/Field.jsx";
import ClientPicker from "../components/ClientPicker.jsx";
import PaiementFormModal from "../components/PaiementFormModal.jsx";
import { StatutBadge } from "../components/Badge.jsx";
import usePaginated from "../hooks/usePaginated.js";
import useDebounce from "../hooks/useDebounce.js";
import { useToast } from "../context/ToastContext.jsx";
import { chambresApi, reservationsApi } from "../services/resources.js";
import { STATUTS, aujourdhui, formatDate, formatMontant, nbNuits, nettoyerParams } from "../utils/format.js";

function ReservationForm({ reservation, onClose, onSaved }) {
  const notify = useToast();
  const [form, setForm] = useState({
    client: reservation?.client ?? "", chambre: reservation?.chambre ?? "",
    date_arrivee: reservation?.date_arrivee ?? aujourdhui(), date_depart: reservation?.date_depart ?? "",
    nb_personnes: reservation?.nb_personnes ?? 1, notes: reservation?.notes ?? "",
  });
  const [chambres, setChambres] = useState([]);
  const [errors, setErrors] = useState({});
  const [global, setGlobal] = useState("");
  const [busy, setBusy] = useState(false);
  const nuits = nbNuits(form.date_arrivee, form.date_depart);
  const chambreChoisie = chambres.find((c) => String(c.id) === String(form.chambre));

  // Les chambres proposées sont celles réellement libres sur la période et assez grandes
  useEffect(() => {
    if (nuits < 1) { setChambres([]); return undefined; }
    let actif = true;
    chambresApi.disponibles({
      arrivee: form.date_arrivee, depart: form.date_depart, capacite_min: form.nb_personnes,
      exclude_reservation: reservation?.id,
    }).then((d) => actif && setChambres(d)).catch(() => actif && setChambres([]));
    return () => { actif = false; };
  }, [form.date_arrivee, form.date_depart, form.nb_personnes, nuits, reservation?.id]);

  async function submit(e) {
    e.preventDefault();
    const locales = {};
    if (!form.client) locales.client = "Choisissez un client.";
    if (nuits < 1) locales.date_depart = "Le départ doit être après l'arrivée.";
    if (!form.chambre) locales.chambre = "Choisissez une chambre disponible.";
    if (!(Number(form.nb_personnes) >= 1)) locales.nb_personnes = "Au moins 1 personne.";
    setErrors(locales);
    if (Object.keys(locales).length) return;
    setBusy(true);
    try {
      const payload = { ...form, client: Number(form.client), chambre: Number(form.chambre), nb_personnes: Number(form.nb_personnes) };
      reservation ? await reservationsApi.update(reservation.id, payload) : await reservationsApi.create(payload);
      notify.success(reservation ? "Réservation modifiée." : "Réservation créée (en attente).");
      onSaved();
    } catch (err) {
      setErrors(err.fieldErrors || {});
      setGlobal(err.message);
    } finally {
      setBusy(false);
    }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <Modal title={reservation ? `Modifier la réservation #${reservation.id}` : "Nouvelle réservation"} onClose={onClose} wide
      footer={<>
        <button className="btn btn-light" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" form="resa-form" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
      </>}>
      <form id="resa-form" onSubmit={submit} noValidate className="form-grid">
        {global && <div className="state state-error" role="alert">{global}</div>}
        <Field label="Client" error={errors.client}>
          <ClientPicker value={form.client} onChange={(v) => setForm({ ...form, client: v })} initialLabel={reservation?.client_nom} />
        </Field>
        <Field label="Arrivée" error={errors.date_arrivee}><input type="date" value={form.date_arrivee} onChange={set("date_arrivee")} /></Field>
        <Field label="Départ" error={errors.date_depart}><input type="date" value={form.date_depart} min={form.date_arrivee} onChange={set("date_depart")} /></Field>
        <Field label="Nombre de personnes" error={errors.nb_personnes}><input type="number" min="1" value={form.nb_personnes} onChange={set("nb_personnes")} /></Field>
        <Field label="Chambre disponible" error={errors.chambre} hint={nuits < 1 ? "Renseignez d'abord les dates." : `${chambres.length} chambre(s) libre(s) sur la période.`}>
          <select value={form.chambre} onChange={set("chambre")}>
            <option value="">— Choisir —</option>
            {chambres.map((c) => <option key={c.id} value={c.id}>{c.numero} – {c.categorie_nom} ({c.capacite} pers.) – {formatMontant(c.prix_nuit)}/nuit</option>)}
          </select>
        </Field>
        <Field label="Notes" error={errors.notes}><textarea rows="2" value={form.notes} onChange={set("notes")} /></Field>
        {chambreChoisie && nuits > 0 && (
          <div className="info-box">{nuits} nuit(s) × {formatMontant(chambreChoisie.prix_nuit)} = <strong>{formatMontant(nuits * Number(chambreChoisie.prix_nuit))}</strong> (le prix définitif est calculé par le serveur)</div>
        )}
      </form>
    </Modal>
  );
}

const ACTIONS = {
  confirmer: { label: "Confirmer", message: "Confirmer cette réservation ? La disponibilité sera revérifiée.", danger: false },
  annuler: { label: "Annuler la réservation", message: "Annuler cette réservation ? Cette action est définitive.", danger: true },
  terminer: { label: "Terminer", message: "Marquer le séjour comme terminé ?", danger: false },
};

export default function ReservationsPage() {
  const notify = useToast();
  const [filtres, setFiltres] = useState({ search: "", statut: "", date_debut: "", date_fin: "" });
  const recherche = useDebounce(filtres.search);
  const liste = usePaginated(reservationsApi.list, nettoyerParams({ ...filtres, search: recherche }));
  const [formulaire, setFormulaire] = useState(null);
  const [paiement, setPaiement] = useState(null);
  const [confirmation, setConfirmation] = useState(null); // { reservation, action }
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setFiltres({ ...filtres, [k]: e.target.value });

  async function executer() {
    setBusy(true);
    try {
      await reservationsApi[confirmation.action](confirmation.reservation.id);
      notify.success("Statut mis à jour.");
      liste.reload();
    } catch (err) {
      notify.error(err.message);
    } finally {
      setBusy(false);
      setConfirmation(null);
    }
  }

  return (
    <>
      <PageHeader title="Réservations" subtitle="Création, suivi des statuts et encaissements"
        actions={<button className="btn btn-primary" onClick={() => setFormulaire("new")}>+ Nouvelle réservation</button>} />
      <div className="card filters">
        <Field label="Recherche"><input placeholder="Client, chambre, téléphone…" value={filtres.search} onChange={set("search")} /></Field>
        <Field label="Statut"><select value={filtres.statut} onChange={set("statut")}>
          <option value="">Tous</option>{Object.entries(STATUTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Séjour à partir du"><input type="date" value={filtres.date_debut} onChange={set("date_debut")} /></Field>
        <Field label="Jusqu'au"><input type="date" value={filtres.date_fin} min={filtres.date_debut} onChange={set("date_fin")} /></Field>
      </div>
      <div className="card">
        <DataState loading={liste.loading} error={liste.error} empty={liste.results.length === 0} emptyText="Aucune réservation ne correspond.">
          <div className="table-wrap"><table>
            <thead><tr><th>N°</th><th>Client</th><th>Ch.</th><th>Séjour</th><th>Nuits</th><th>Total</th><th>Payé</th><th>Solde</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>{liste.results.map((r) => {
              const active = r.statut === "EN_ATTENTE" || r.statut === "CONFIRMEE";
              return (
                <tr key={r.id}>
                  <td>#{r.id}</td><td>{r.client_nom}</td><td>{r.chambre_numero}</td>
                  <td>{formatDate(r.date_arrivee)} → {formatDate(r.date_depart)}</td><td>{r.nb_nuits}</td>
                  <td>{formatMontant(r.prix_total)}</td><td>{formatMontant(r.montant_paye)}</td><td>{formatMontant(r.solde)}</td>
                  <td><StatutBadge statut={r.statut} libelle={r.statut_libelle} /></td>
                  <td className="actions">
                    {active && <button className="btn btn-light" onClick={() => setFormulaire(r)}>Modifier</button>}
                    {r.statut === "EN_ATTENTE" && <button className="btn btn-light" onClick={() => setConfirmation({ reservation: r, action: "confirmer" })}>Confirmer</button>}
                    {r.statut === "CONFIRMEE" && <button className="btn btn-light" onClick={() => setConfirmation({ reservation: r, action: "terminer" })}>Terminer</button>}
                    {active && <button className="btn btn-light danger-text" onClick={() => setConfirmation({ reservation: r, action: "annuler" })}>Annuler</button>}
                    {active && Number(r.solde) > 0 && <button className="btn btn-light" onClick={() => setPaiement(r)}>Encaisser</button>}
                  </td>
                </tr>
              );
            })}</tbody>
          </table></div>
        </DataState>
        <Pagination count={liste.count} page={liste.page} onChange={liste.setPage} />
      </div>
      {formulaire && <ReservationForm reservation={formulaire === "new" ? null : formulaire}
        onClose={() => setFormulaire(null)} onSaved={() => { setFormulaire(null); liste.reload(); }} />}
      {paiement && <PaiementFormModal reservation={paiement} onClose={() => setPaiement(null)}
        onSaved={() => { setPaiement(null); liste.reload(); }} />}
      {confirmation && (
        <ConfirmDialog busy={busy} danger={ACTIONS[confirmation.action].danger}
          title={`${ACTIONS[confirmation.action].label} – #${confirmation.reservation.id}`}
          message={ACTIONS[confirmation.action].message} confirmLabel={ACTIONS[confirmation.action].label}
          onConfirm={executer} onCancel={() => setConfirmation(null)} />
      )}
    </>
  );
}
