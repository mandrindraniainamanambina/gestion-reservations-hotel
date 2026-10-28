import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader.jsx";
import DataState from "../components/DataState.jsx";
import Pagination from "../components/Pagination.jsx";
import Modal from "../components/Modal.jsx";
import Field from "../components/Field.jsx";
import { StatutBadge } from "../components/Badge.jsx";
import usePaginated from "../hooks/usePaginated.js";
import useDebounce from "../hooks/useDebounce.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { clientsApi } from "../services/resources.js";
import { formatDate, formatMontant } from "../utils/format.js";

function ClientForm({ client, onClose, onSaved }) {
  const { isAdmin } = useAuth();
  const notify = useToast();
  const [form, setForm] = useState({
    nom: client?.nom ?? "", prenom: client?.prenom ?? "", telephone: client?.telephone ?? "",
    email: client?.email ?? "", adresse: client?.adresse ?? "", piece_identite: client?.piece_identite ?? "",
  });
  const [errors, setErrors] = useState({});
  const [global, setGlobal] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    const locales = {};
    if (!form.nom.trim()) locales.nom = "Nom obligatoire.";
    if (!form.prenom.trim()) locales.prenom = "Prénom obligatoire.";
    if (!form.telephone.trim()) locales.telephone = "Téléphone obligatoire.";
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) locales.email = "E-mail invalide.";
    if (isAdmin && form.piece_identite && !/^\d{14}$/.test(form.piece_identite)) {
      locales.piece_identite = "Le numéro de CIN doit contenir exactement 14 chiffres.";
    }
    setErrors(locales);
    if (Object.keys(locales).length) return;
    setBusy(true);
    try {
      const payload = { ...form };
      if (!isAdmin) delete payload.piece_identite; // champ réservé aux administrateurs
      client ? await clientsApi.update(client.id, payload) : await clientsApi.create(payload);
      notify.success(client ? "Client modifié." : "Client enregistré.");
      onSaved();
    } catch (err) {
      setErrors(err.fieldErrors || {});
      setGlobal(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={client ? "Modifier le client" : "Nouveau client"} onClose={onClose}
      footer={<>
        <button className="btn btn-light" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" form="client-form" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
      </>}>
      <form id="client-form" onSubmit={submit} noValidate className="form-grid">
        {global && <div className="state state-error" role="alert">{global}</div>}
        <Field label="Nom" error={errors.nom}><input value={form.nom} onChange={set("nom")} /></Field>
        <Field label="Prénom" error={errors.prenom}><input value={form.prenom} onChange={set("prenom")} /></Field>
        <Field label="Téléphone" error={errors.telephone}><input value={form.telephone} onChange={set("telephone")} /></Field>
        <Field label="E-mail" error={errors.email}><input type="email" value={form.email} onChange={set("email")} /></Field>
        <Field label="Adresse" error={errors.adresse}><input value={form.adresse} onChange={set("adresse")} /></Field>
        {isAdmin && <Field label="Pièce d'identité" error={errors.piece_identite} hint="14 chiffres exactement. Donnée sensible, visible des administrateurs seulement."><input value={form.piece_identite} onChange={set("piece_identite")} inputMode="numeric" pattern="[0-9]{14}" maxLength={14} minLength={14} placeholder="14 chiffres" aria-describedby="cin-help" /></Field>}
      </form>
    </Modal>
  );
}

function HistoriqueModal({ client, onClose }) {
  const [etat, setEtat] = useState({ loading: true, error: "", data: [] });
  useEffect(() => {
    clientsApi.historique(client.id)
      .then((data) => setEtat({ loading: false, error: "", data }))
      .catch((e) => setEtat({ loading: false, error: e.message, data: [] }));
  }, [client.id]);
  return (
    <Modal title={`Historique – ${client.nom} ${client.prenom}`} onClose={onClose} wide>
      <DataState loading={etat.loading} error={etat.error} empty={etat.data.length === 0} emptyText="Aucune réservation pour ce client.">
        <div className="table-wrap"><table>
          <thead><tr><th>N°</th><th>Chambre</th><th>Séjour</th><th>Total</th><th>Solde</th><th>Statut</th></tr></thead>
          <tbody>{etat.data.map((r) => (
            <tr key={r.id}><td>#{r.id}</td><td>{r.chambre_numero}</td>
              <td>{formatDate(r.date_arrivee)} → {formatDate(r.date_depart)}</td>
              <td>{formatMontant(r.prix_total)}</td><td>{formatMontant(r.solde)}</td>
              <td><StatutBadge statut={r.statut} libelle={r.statut_libelle} /></td></tr>
          ))}</tbody>
        </table></div>
      </DataState>
    </Modal>
  );
}

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const recherche = useDebounce(search);
  const liste = usePaginated(clientsApi.list, { search: recherche });
  const [formulaire, setFormulaire] = useState(null);
  const [historique, setHistorique] = useState(null);

  return (
    <>
      <PageHeader title="Clients" subtitle="Fiches clients et historique des séjours"
        actions={<button className="btn btn-primary" onClick={() => setFormulaire("new")}>+ Nouveau client</button>} />
      <div className="card filters">
        <Field label="Recherche"><input placeholder="Nom, prénom, e-mail, téléphone…" value={search} onChange={(e) => setSearch(e.target.value)} /></Field>
      </div>
      <div className="card">
        <DataState loading={liste.loading} error={liste.error} empty={liste.results.length === 0} emptyText="Aucun client trouvé.">
          <div className="table-wrap"><table>
            <thead><tr><th>Nom</th><th>Prénom</th><th>Téléphone</th><th>E-mail</th><th>Inscrit le</th><th>Actions</th></tr></thead>
            <tbody>{liste.results.map((c) => (
              <tr key={c.id}><td><strong>{c.nom}</strong></td><td>{c.prenom}</td><td>{c.telephone}</td><td>{c.email || "—"}</td>
                <td>{formatDate(c.created_at)}</td>
                <td className="actions">
                  <button className="btn btn-light" onClick={() => setFormulaire(c)}>Modifier</button>
                  <button className="btn btn-light" onClick={() => setHistorique(c)}>Historique</button>
                </td></tr>
            ))}</tbody>
          </table></div>
        </DataState>
        <Pagination count={liste.count} page={liste.page} onChange={liste.setPage} />
      </div>
      {formulaire && <ClientForm client={formulaire === "new" ? null : formulaire}
        onClose={() => setFormulaire(null)} onSaved={() => { setFormulaire(null); liste.reload(); }} />}
      {historique && <HistoriqueModal client={historique} onClose={() => setHistorique(null)} />}
    </>
  );
}
