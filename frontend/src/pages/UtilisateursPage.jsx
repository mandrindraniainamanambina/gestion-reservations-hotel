import { useState } from "react";
import PageHeader from "../components/PageHeader.jsx";
import DataState from "../components/DataState.jsx";
import Pagination from "../components/Pagination.jsx";
import Modal from "../components/Modal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import Field from "../components/Field.jsx";
import { Badge } from "../components/Badge.jsx";
import usePaginated from "../hooks/usePaginated.js";
import { useToast } from "../context/ToastContext.jsx";
import { utilisateursApi } from "../services/resources.js";

const ROLES = { ADMIN: "Administrateur", RECEPTIONNISTE: "Réceptionniste" };

function UserForm({ utilisateur, onClose, onSaved }) {
  const notify = useToast();
  const [form, setForm] = useState({
    username: utilisateur?.username ?? "", first_name: utilisateur?.first_name ?? "", last_name: utilisateur?.last_name ?? "",
    email: utilisateur?.email ?? "", role: utilisateur?.role ?? "RECEPTIONNISTE", password: "",
  });
  const [errors, setErrors] = useState({});
  const [global, setGlobal] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    const locales = {};
    if (!form.username.trim()) locales.username = "Identifiant obligatoire.";
    if (!utilisateur && !form.password) locales.password = "Mot de passe obligatoire.";
    setErrors(locales);
    if (Object.keys(locales).length) return;
    setBusy(true);
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      utilisateur ? await utilisateursApi.update(utilisateur.id, payload) : await utilisateursApi.create(payload);
      notify.success(utilisateur ? "Utilisateur modifié." : "Utilisateur créé.");
      onSaved();
    } catch (err) {
      setErrors(err.fieldErrors || {});
      setGlobal(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={utilisateur ? "Modifier l'utilisateur" : "Nouvel utilisateur"} onClose={onClose}
      footer={<>
        <button className="btn btn-light" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" form="user-form" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
      </>}>
      <form id="user-form" onSubmit={submit} noValidate className="form-grid">
        {global && <div className="state state-error" role="alert">{global}</div>}
        <Field label="Identifiant" error={errors.username}><input value={form.username} onChange={set("username")} autoComplete="off" /></Field>
        <Field label="Prénom" error={errors.first_name}><input value={form.first_name} onChange={set("first_name")} /></Field>
        <Field label="Nom" error={errors.last_name}><input value={form.last_name} onChange={set("last_name")} /></Field>
        <Field label="E-mail" error={errors.email}><input type="email" value={form.email} onChange={set("email")} /></Field>
        <Field label="Rôle" error={errors.role}>
          <select value={form.role} onChange={set("role")}>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </Field>
        <Field label={utilisateur ? "Nouveau mot de passe (facultatif)" : "Mot de passe"} error={errors.password}>
          <input type="password" value={form.password} onChange={set("password")} autoComplete="new-password" />
        </Field>
      </form>
    </Modal>
  );
}

export default function UtilisateursPage() {
  const notify = useToast();
  const liste = usePaginated(utilisateursApi.list, {});
  const [formulaire, setFormulaire] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [busy, setBusy] = useState(false);

  async function basculer() {
    setBusy(true);
    try {
      const { utilisateur, activer } = confirmation;
      activer ? await utilisateursApi.activer(utilisateur.id) : await utilisateursApi.desactiver(utilisateur.id);
      notify.success(activer ? "Compte réactivé." : "Compte désactivé.");
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
      <PageHeader title="Utilisateurs" subtitle="Comptes et rôles (administrateurs uniquement)"
        actions={<button className="btn btn-primary" onClick={() => setFormulaire("new")}>+ Nouvel utilisateur</button>} />
      <div className="card">
        <DataState loading={liste.loading} error={liste.error} empty={liste.results.length === 0}>
          <div className="table-wrap"><table>
            <thead><tr><th>Identifiant</th><th>Nom</th><th>Rôle</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>{liste.results.map((u) => (
              <tr key={u.id}><td><strong>{u.username}</strong></td><td>{u.first_name} {u.last_name}</td><td>{ROLES[u.role]}</td>
                <td><Badge tone={u.is_active ? "green" : "gray"}>{u.is_active ? "Actif" : "Désactivé"}</Badge></td>
                <td className="actions">
                  <button className="btn btn-light" onClick={() => setFormulaire(u)}>Modifier</button>
                  {u.is_active
                    ? <button className="btn btn-light danger-text" onClick={() => setConfirmation({ utilisateur: u, activer: false })}>Désactiver</button>
                    : <button className="btn btn-light" onClick={() => setConfirmation({ utilisateur: u, activer: true })}>Réactiver</button>}
                </td></tr>
            ))}</tbody>
          </table></div>
        </DataState>
        <Pagination count={liste.count} page={liste.page} onChange={liste.setPage} />
      </div>
      {formulaire && <UserForm utilisateur={formulaire === "new" ? null : formulaire}
        onClose={() => setFormulaire(null)} onSaved={() => { setFormulaire(null); liste.reload(); }} />}
      {confirmation && (
        <ConfirmDialog busy={busy} danger={!confirmation.activer}
          title={confirmation.activer ? "Réactiver le compte" : "Désactiver le compte"}
          message={`${confirmation.activer ? "Réactiver" : "Désactiver"} le compte « ${confirmation.utilisateur.username} » ?`}
          confirmLabel={confirmation.activer ? "Réactiver" : "Désactiver"}
          onConfirm={basculer} onCancel={() => setConfirmation(null)} />
      )}
    </>
  );
}
