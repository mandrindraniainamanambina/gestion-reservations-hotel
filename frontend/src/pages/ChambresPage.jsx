import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader.jsx";
import DataState from "../components/DataState.jsx";
import Pagination from "../components/Pagination.jsx";
import Modal from "../components/Modal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import Field from "../components/Field.jsx";
import { Badge } from "../components/Badge.jsx";
import usePaginated from "../hooks/usePaginated.js";
import useDebounce from "../hooks/useDebounce.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { categoriesApi, chambresApi } from "../services/resources.js";
import { aujourdhui, formatMontant, nettoyerParams } from "../utils/format.js";

function etatChambre(c) {
  if (!c.est_active) return { label: "Désactivée", tone: "gray" };
  if (c.occupee) return { label: "Occupée", tone: "red" };
  if (c.etat === "MAINTENANCE") return { label: "Maintenance", tone: "orange" };
  return { label: "Disponible", tone: "green" };
}

function ChambreForm({ chambre, categories, onClose, onSaved }) {
  const notify = useToast();
  const [form, setForm] = useState({
    numero: chambre?.numero ?? "", categorie: chambre?.categorie ?? categories[0]?.id ?? "",
    capacite: chambre?.capacite ?? 2, prix_nuit: chambre?.prix_nuit ?? "", description: chambre?.description ?? "",
    etat: chambre?.etat ?? "DISPONIBLE",
  });
  const [errors, setErrors] = useState({});
  const [global, setGlobal] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    const locales = {};
    if (!form.numero.trim()) locales.numero = "Numéro obligatoire.";
    if (!form.categorie) locales.categorie = "Choisissez une catégorie.";
    if (!(Number(form.capacite) >= 1)) locales.capacite = "Capacité minimale : 1.";
    if (!(Number(form.prix_nuit) > 0)) locales.prix_nuit = "Le prix doit être supérieur à 0.";
    setErrors(locales);
    if (Object.keys(locales).length) return;
    setBusy(true);
    try {
      const payload = { ...form, categorie: Number(form.categorie), capacite: Number(form.capacite) };
      chambre ? await chambresApi.update(chambre.id, payload) : await chambresApi.create(payload);
      notify.success(chambre ? "Chambre modifiée." : "Chambre ajoutée.");
      onSaved();
    } catch (err) {
      setErrors(err.fieldErrors || {});
      setGlobal(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={chambre ? `Modifier la chambre ${chambre.numero}` : "Nouvelle chambre"} onClose={onClose}
      footer={<>
        <button className="btn btn-light" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" form="chambre-form" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
      </>}>
      <form id="chambre-form" onSubmit={submit} noValidate className="form-grid">
        {global && <div className="state state-error" role="alert">{global}</div>}
        <Field label="Numéro" error={errors.numero}><input value={form.numero} onChange={set("numero")} /></Field>
        <Field label="Catégorie" error={errors.categorie}>
          <select value={form.categorie} onChange={set("categorie")}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </Field>
        <Field label="Capacité (personnes)" error={errors.capacite}><input type="number" min="1" value={form.capacite} onChange={set("capacite")} /></Field>
        <Field label="Prix par nuit" error={errors.prix_nuit}><input type="number" min="0" step="0.01" value={form.prix_nuit} onChange={set("prix_nuit")} /></Field>
        <Field label="État" error={errors.etat}>
          <select value={form.etat} onChange={set("etat")}>
            <option value="DISPONIBLE">Disponible</option><option value="MAINTENANCE">En maintenance</option>
          </select>
        </Field>
        <Field label="Description" error={errors.description}><textarea rows="3" value={form.description} onChange={set("description")} /></Field>
      </form>
    </Modal>
  );
}

function CategoriesModal({ categories, onClose, onChanged }) {
  const notify = useToast();
  const [nom, setNom] = useState("");
  const [aSupprimer, setASupprimer] = useState(null);

  async function ajouter(e) {
    e.preventDefault();
    if (!nom.trim()) return notify.error("Saisissez un nom de catégorie.");
    try {
      await categoriesApi.create({ nom: nom.trim() });
      setNom("");
      notify.success("Catégorie ajoutée.");
      onChanged();
    } catch (err) {
      notify.error(err.fieldErrors?.nom || err.message);
    }
  }
  async function supprimer() {
    try {
      await categoriesApi.remove(aSupprimer.id);
      notify.success("Catégorie supprimée.");
      onChanged();
    } catch (err) {
      notify.error(err.message);
    }
    setASupprimer(null);
  }

  return (
    <Modal title="Catégories de chambres" onClose={onClose}>
      <form onSubmit={ajouter} className="inline-form">
        <input placeholder="Nouvelle catégorie" value={nom} onChange={(e) => setNom(e.target.value)} />
        <button className="btn btn-primary">Ajouter</button>
      </form>
      <ul className="plain-list">
        {categories.map((c) => (
          <li key={c.id}>{c.nom}
            <button className="btn btn-ghost danger-text" onClick={() => setASupprimer(c)}>Supprimer</button>
          </li>
        ))}
      </ul>
      {aSupprimer && (
        <ConfirmDialog title="Supprimer la catégorie" danger confirmLabel="Supprimer"
          message={`Supprimer « ${aSupprimer.nom} » ? Impossible si des chambres l'utilisent.`}
          onConfirm={supprimer} onCancel={() => setASupprimer(null)} />
      )}
    </Modal>
  );
}

function DisponiblesModal({ onClose }) {
  const [dates, setDates] = useState({ arrivee: aujourdhui(), depart: "" });
  const [resultat, setResultat] = useState(null);
  const [error, setError] = useState("");

  async function chercher(e) {
    e.preventDefault();
    setError("");
    try {
      setResultat(await chambresApi.disponibles(dates));
    } catch (err) {
      setResultat(null);
      setError(err.fieldErrors?.arrivee || err.fieldErrors?.depart || err.message);
    }
  }

  return (
    <Modal title="Chambres disponibles" onClose={onClose} wide>
      <form onSubmit={chercher} className="inline-form">
        <Field label="Arrivée"><input type="date" value={dates.arrivee} onChange={(e) => setDates({ ...dates, arrivee: e.target.value })} /></Field>
        <Field label="Départ"><input type="date" value={dates.depart} min={dates.arrivee} onChange={(e) => setDates({ ...dates, depart: e.target.value })} /></Field>
        <button className="btn btn-primary">Rechercher</button>
      </form>
      {error && <div className="state state-error">{error}</div>}
      {resultat && (
        <DataState empty={resultat.length === 0} emptyText="Aucune chambre disponible sur cette période.">
          <div className="table-wrap"><table>
            <thead><tr><th>Chambre</th><th>Catégorie</th><th>Capacité</th><th>Prix / nuit</th></tr></thead>
            <tbody>{resultat.map((c) => (
              <tr key={c.id}><td>{c.numero}</td><td>{c.categorie_nom}</td><td>{c.capacite}</td><td>{formatMontant(c.prix_nuit)}</td></tr>
            ))}</tbody>
          </table></div>
        </DataState>
      )}
    </Modal>
  );
}

export default function ChambresPage() {
  const { isAdmin } = useAuth();
  const notify = useToast();
  const [categories, setCategories] = useState([]);
  const [filtres, setFiltres] = useState({ search: "", categorie: "", capacite_min: "", prix_max: "", actif: "" });
  const recherche = useDebounce(filtres.search);
  const params = nettoyerParams({ ...filtres, search: recherche });
  const liste = usePaginated(chambresApi.list, params);
  const [formulaire, setFormulaire] = useState(null); // null | "new" | chambre
  const [modal, setModal] = useState(null); // "categories" | "disponibles"
  const [confirmation, setConfirmation] = useState(null);
  const [busy, setBusy] = useState(false);

  const chargerCategories = () => categoriesApi.list().then(setCategories).catch((e) => notify.error(e.message));
  useEffect(() => { chargerCategories(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function basculer() {
    setBusy(true);
    try {
      const { chambre, activer } = confirmation;
      activer ? await chambresApi.activer(chambre.id) : await chambresApi.desactiver(chambre.id);
      notify.success(activer ? "Chambre réactivée." : "Chambre désactivée.");
      liste.reload();
    } catch (err) {
      notify.error(err.message);
    } finally {
      setBusy(false);
      setConfirmation(null);
    }
  }

  const set = (k) => (e) => setFiltres({ ...filtres, [k]: e.target.value });

  return (
    <>
      <PageHeader title="Chambres" subtitle="Catalogue, tarifs et disponibilité"
        actions={<>
          <button className="btn btn-light" onClick={() => setModal("disponibles")}>Voir les disponibilités</button>
          {isAdmin && <button className="btn btn-light" onClick={() => setModal("categories")}>Catégories</button>}
          <button className="btn btn-primary" onClick={() => setFormulaire("new")} disabled={categories.length === 0}>+ Nouvelle chambre</button>
        </>} />
      <div className="card filters">
        <Field label="Recherche"><input placeholder="Numéro, description…" value={filtres.search} onChange={set("search")} /></Field>
        <Field label="Catégorie"><select value={filtres.categorie} onChange={set("categorie")}>
          <option value="">Toutes</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></Field>
        <Field label="Capacité min."><input type="number" min="1" value={filtres.capacite_min} onChange={set("capacite_min")} /></Field>
        <Field label="Prix max."><input type="number" min="0" value={filtres.prix_max} onChange={set("prix_max")} /></Field>
        <Field label="Statut"><select value={filtres.actif} onChange={set("actif")}>
          <option value="">Toutes</option><option value="true">Actives</option><option value="false">Désactivées</option></select></Field>
      </div>
      <div className="card">
        <DataState loading={liste.loading} error={liste.error} empty={liste.results.length === 0}
          emptyText={categories.length === 0 ? "Créez d'abord une catégorie (administrateur)." : "Aucune chambre ne correspond."}>
          <div className="table-wrap"><table>
            <thead><tr><th>N°</th><th>Catégorie</th><th>Capacité</th><th>Prix / nuit</th><th>État</th><th>Actions</th></tr></thead>
            <tbody>{liste.results.map((c) => {
              const etat = etatChambre(c);
              return (
                <tr key={c.id}>
                  <td><strong>{c.numero}</strong></td><td>{c.categorie_nom}</td><td>{c.capacite}</td>
                  <td>{formatMontant(c.prix_nuit)}</td><td><Badge tone={etat.tone}>{etat.label}</Badge></td>
                  <td className="actions">
                    <button className="btn btn-light" onClick={() => setFormulaire(c)}>Modifier</button>
                    {isAdmin && (c.est_active
                      ? <button className="btn btn-light danger-text" onClick={() => setConfirmation({ chambre: c, activer: false })}>Désactiver</button>
                      : <button className="btn btn-light" onClick={() => setConfirmation({ chambre: c, activer: true })}>Réactiver</button>)}
                  </td>
                </tr>
              );
            })}</tbody>
          </table></div>
        </DataState>
        <Pagination count={liste.count} page={liste.page} onChange={liste.setPage} />
      </div>

      {formulaire && <ChambreForm chambre={formulaire === "new" ? null : formulaire} categories={categories}
        onClose={() => setFormulaire(null)} onSaved={() => { setFormulaire(null); liste.reload(); }} />}
      {modal === "categories" && <CategoriesModal categories={categories} onClose={() => setModal(null)} onChanged={chargerCategories} />}
      {modal === "disponibles" && <DisponiblesModal onClose={() => setModal(null)} />}
      {confirmation && (
        <ConfirmDialog busy={busy} danger={!confirmation.activer}
          title={confirmation.activer ? "Réactiver la chambre" : "Désactiver la chambre"}
          message={`${confirmation.activer ? "Réactiver" : "Désactiver"} la chambre ${confirmation.chambre.numero} ?`}
          confirmLabel={confirmation.activer ? "Réactiver" : "Désactiver"}
          onConfirm={basculer} onCancel={() => setConfirmation(null)} />
      )}
    </>
  );
}
