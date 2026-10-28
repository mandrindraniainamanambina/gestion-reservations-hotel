import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const LIENS = [
  { to: "/", label: "Tableau de bord", end: true },
  { to: "/chambres", label: "Chambres" },
  { to: "/clients", label: "Clients" },
  { to: "/reservations", label: "Réservations" },
  { to: "/paiements", label: "Paiements" },
  { to: "/rapports", label: "Rapports" },
];

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const [ouvert, setOuvert] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const liens = isAdmin ? [...LIENS, { to: "/utilisateurs", label: "Utilisateurs" }] : LIENS;

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="btn btn-ghost menu-btn" onClick={() => setOuvert(!ouvert)} aria-label="Menu">☰</button>
        <strong>Hôtel – Réservations</strong>
        <button className="btn btn-light about-top" onClick={() => setAboutOpen(true)}>À propos</button>
      </header>
      <aside className={`sidebar ${ouvert ? "open" : ""}`}>
        <div className="brand">🏨 Gestion hôtelière</div>
        <nav>
          {liens.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} onClick={() => setOuvert(false)}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              {l.label}
            </NavLink>
          ))}
          <button className="nav-link about-link" onClick={() => { setAboutOpen(true); setOuvert(false); }}>À propos du projet</button>
        </nav>
        <div className="sidebar-footer">
          <div className="user-box">
            <strong>{user.first_name || user.username}</strong>
            <small>{user.role === "ADMIN" ? "Administrateur" : "Réceptionniste"}</small>
          </div>
          <button className="btn btn-light" onClick={logout}>Se déconnecter</button>
        </div>
      </aside>
      <main className="content"><Outlet /></main>
      {aboutOpen && <div className="about-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setAboutOpen(false); }}>
        <section className="about-dialog" role="dialog" aria-modal="true" aria-labelledby="about-title">
          <div className="about-heading"><div><h2 id="about-title">À propos du projet</h2><p>Gestion des réservations d’hôtel · Django REST · React · PostgreSQL</p></div><button className="btn btn-ghost" onClick={() => setAboutOpen(false)} aria-label="Fermer">✕</button></div>
          <div className="about-pdf"><iframe src="/MPD.pdf#toolbar=1&navpanes=0" title="Modèle physique des données (MPD)" /></div>
          <div className="about-actions"><a className="btn btn-light" href="/MPD.pdf" target="_blank" rel="noreferrer">Ouvrir en plein écran</a><a className="btn btn-primary" href="/MPD.pdf" download="MPD-gestion-reservations-hotel.pdf">Télécharger le MPD</a></div>
        </section>
      </div>}
    </div>
  );
}
