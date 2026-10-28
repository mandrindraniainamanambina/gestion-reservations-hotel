// Affiche chargement / erreur / état vide, sinon le contenu.
export default function DataState({ loading, error, empty, emptyText = "Aucun résultat.", children }) {
  if (error) return <div className="state state-error" role="alert">{error}</div>;
  if (loading) return <div className="state"><div className="spinner" /> Chargement…</div>;
  if (empty) return <div className="state">{emptyText}</div>;
  return children;
}
