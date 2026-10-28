import { useEffect, useState } from "react";
import useDebounce from "../hooks/useDebounce.js";
import { clientsApi } from "../services/resources.js";

// Recherche un client côté serveur puis le sélectionne dans une liste.
export default function ClientPicker({ value, onChange, initialLabel = "" }) {
  const [texte, setTexte] = useState("");
  const recherche = useDebounce(texte);
  const [options, setOptions] = useState([]);

  useEffect(() => {
    let actif = true;
    clientsApi.list({ search: recherche, page_size: 20 })
      .then((d) => actif && setOptions(d.results))
      .catch(() => actif && setOptions([]));
    return () => { actif = false; };
  }, [recherche]);

  const presentDansListe = options.some((o) => String(o.id) === String(value));
  return (
    <div className="picker">
      <input placeholder="Rechercher un client (nom, téléphone…)" value={texte} onChange={(e) => setTexte(e.target.value)} />
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Choisir un client —</option>
        {value && !presentDansListe && <option value={value}>{initialLabel || `Client #${value}`}</option>}
        {options.map((c) => <option key={c.id} value={c.id}>{c.nom} {c.prenom} – {c.telephone}</option>)}
      </select>
    </div>
  );
}
