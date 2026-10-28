const TONS = { EN_ATTENTE: "orange", CONFIRMEE: "blue", ANNULEE: "gray", TERMINEE: "green" };

export function Badge({ tone = "gray", children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function StatutBadge({ statut, libelle }) {
  return <Badge tone={TONS[statut] || "gray"}>{libelle}</Badge>;
}
