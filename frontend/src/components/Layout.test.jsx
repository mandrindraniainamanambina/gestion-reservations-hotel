import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Layout from "./Layout.jsx";

let mockAuth;
vi.mock("../context/AuthContext.jsx", () => ({ useAuth: () => mockAuth }));

function afficher() {
  render(<MemoryRouter><Layout /></MemoryRouter>);
}

describe("Layout", () => {
  it("masque le menu Utilisateurs au réceptionniste", () => {
    mockAuth = { user: { username: "r", role: "RECEPTIONNISTE" }, isAdmin: false, logout: vi.fn() };
    afficher();
    expect(screen.queryByText("Utilisateurs")).toBeNull();
    expect(screen.getByText("Réservations")).toBeTruthy();
  });

  it("affiche le menu Utilisateurs à l'administrateur", () => {
    mockAuth = { user: { username: "a", role: "ADMIN" }, isAdmin: true, logout: vi.fn() };
    afficher();
    expect(screen.getByText("Utilisateurs")).toBeTruthy();
  });
});
