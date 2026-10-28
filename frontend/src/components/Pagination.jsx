import { PAGE_SIZE } from "../hooks/usePaginated.js";

export default function Pagination({ count, page, onChange }) {
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  if (count <= PAGE_SIZE) return <p className="muted small">{count} résultat{count > 1 ? "s" : ""}</p>;
  return (
    <div className="pagination">
      <span className="muted small">{count} résultats</span>
      <button className="btn btn-light" disabled={page <= 1} onClick={() => onChange(page - 1)}>← Précédent</button>
      <span>Page {page} / {pages}</span>
      <button className="btn btn-light" disabled={page >= pages} onClick={() => onChange(page + 1)}>Suivant →</button>
    </div>
  );
}
