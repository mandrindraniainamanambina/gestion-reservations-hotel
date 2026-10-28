export const DEVISE = "Ar"; // Ariary : modifiable ici

export const STATUTS = {
  EN_ATTENTE: "En attente",
  CONFIRMEE: "Confirmée",
  ANNULEE: "Annulée",
  TERMINEE: "Terminée",
};
export const MODES = { ESPECES: "Espèces", CARTE: "Carte bancaire", MOBILE_MONEY: "Mobile money", VIREMENT: "Virement" };
export const TYPES_PAIEMENT = { PAIEMENT: "Paiement", REMBOURSEMENT: "Remboursement" };

export function formatMontant(valeur) {
  const n = Number(valeur);
  if (valeur === null || valeur === undefined || valeur === "" || Number.isNaN(n)) return "—";
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n)} ${DEVISE}`;
}

// Les dates "AAAA-MM-JJ" sont lues sans fuseau pour éviter tout décalage d'un jour.
export function formatDate(iso) {
  if (!iso) return "—";
  const [datePart] = String(iso).split("T");
  const [y, m, d] = datePart.split("-");
  return y && m && d ? `${d}/${m}/${y}` : "—";
}

export function formatDateHeure(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export function aujourdhui() {
  const d = new Date();
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function nbNuits(arrivee, depart) {
  if (!arrivee || !depart) return 0;
  const ms = new Date(`${depart}T00:00:00Z`) - new Date(`${arrivee}T00:00:00Z`);
  return Math.max(0, Math.round(ms / 86400000));
}

export function nettoyerParams(params) {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v !== null && v !== undefined));
}
