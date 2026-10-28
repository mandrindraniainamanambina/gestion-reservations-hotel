import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import Field from "./Field.jsx";
import useDebounce from "../hooks/useDebounce.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { paiementsApi, reservationsApi } from "../services/resources.js";
import { MODES, formatMontant } from "../utils/format.js";

// Enregistre un paiement ou (administrateur) un remboursement. `reservation` fixe = ouverture depuis une réservation.
export default function PaiementFormModal({ reservation: fixe, onClose, onSaved }) {
  const { isAdmin } = useAuth();
  const notify = useToast();
  const [reservation, setReservation] = useState(fixe || null);
  const [texte, setTexte] = useState("");
  const recherche = useDebounce(texte);
  const [options, setOptions] = useState([]);
  const [form, setForm] = useState({ type: "PAIEMENT", montant: "", mode: "ESPECES", reference: "" });
  const [errors, setErrors] = useState({});
  const [global, setGlobal] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (fixe) return undefined;
    let actif = true;
    reservationsApi.list({ search: recherche, page_size: 20 }).then((d) => actif && setOptions(d.results)).catch(() => {});
    return () => { actif = false; };
  }, [recherche, fixe]);

  async function submit(e) {
    e.preventDefault();
    const locales = {};
    if (!reservation) locales.reservation = "Choisissez une réservation.";
    if (!(Number(form.montant) > 0)) locales.montant = "Le montant doit être supérieur à 0.";
    setErrors(locales);
    if (Object.keys(locales).length) return;
    setBusy(true);
    try {
      await paiementsApi.create({ ...form, reservation: reservation.id });
      notify.success(form.type === "PAIEMENT" ? "Paiement enregistré." : "Remboursement enregistré.");
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
    <Modal title="Enregistrer un mouvement" onClose={onClose}
      footer={<>
        <button className="btn btn-light" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" form="paiement-form" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
      </>}>
      <form id="paiement-form" onSubmit={submit} noValidate className="form-grid">
        {global && <div className="state state-error" role="alert">{global}</div>}
        {fixe ? (
          <p><strong>Réservation #{fixe.id}</strong> – {fixe.client_nom} – chambre {fixe.chambre_numero}</p>
        ) : (
          <Field label="Réservation" error={errors.reservation}>
            <div className="picker">
              <input placeholder="Rechercher (client, chambre…)" value={texte} onChange={(e) => setTexte(e.target.value)} />
              <select value={reservation?.id || ""} onChange={(e) => setReservation(options.find((o) => String(o.id) === e.target.value) || null)}>
                <option value="">— Choisir —</option>
                {options.map((r) => <option key={r.id} value={r.id}>#{r.id} – {r.client_nom} – ch. {r.chambre_numero} ({r.statut_libelle})</option>)}
              </select>
            </div>
          </Field>
        )}
        {reservation && (
          <div className="info-box">
            Total : {formatMontant(reservation.prix_total)} · Payé : {formatMontant(reservation.montant_paye)} · Solde : <strong>{formatMontant(reservation.solde)}</strong>
          </div>
        )}
        <Field label="Type" error={errors.type} hint={!isAdmin ? "Les remboursements sont réservés aux administrateurs." : "Remboursement : réservation annulée uniquement."}>
          <select value={form.type} onChange={set("type")}>
            <option value="PAIEMENT">Paiement</option>
            {isAdmin && <option value="REMBOURSEMENT">Remboursement</option>}
          </select>
        </Field>
        <Field label="Montant" error={errors.montant}><input type="number" min="0" step="0.01" value={form.montant} onChange={set("montant")} /></Field>
        <Field label="Mode" error={errors.mode}>
          <select value={form.mode} onChange={set("mode")}>{Object.entries(MODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </Field>
        <Field label="Référence (facultatif)" error={errors.reference}><input value={form.reference} onChange={set("reference")} /></Field>
      </form>
    </Modal>
  );
}
