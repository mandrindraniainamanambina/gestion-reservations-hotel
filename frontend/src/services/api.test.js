import { afterEach, describe, expect, it, vi } from "vitest";
import { api, tokenStore } from "./api.js";

afterEach(() => {
  vi.unstubAllGlobals();
  tokenStore.clear();
});

describe("api", () => {
  it("envoie le jeton dans l'en-tête Authorization", async () => {
    tokenStore.set("abc");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: 1 }) });
    vi.stubGlobal("fetch", fetchMock);
    await api.get("/chambres/", { search: "101", vide: "" });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/chambres/?search=101");
    expect(options.headers.Authorization).toBe("Token abc");
  });

  it("transforme les erreurs de validation en ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false, status: 400, json: async () => ({ numero: ["Déjà utilisé."] }),
    }));
    await expect(api.post("/chambres/", {})).rejects.toMatchObject({
      status: 400, fieldErrors: { numero: "Déjà utilisé." },
    });
  });

  it("signale un serveur injoignable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fail")));
    await expect(api.get("/x/")).rejects.toMatchObject({ status: 0 });
  });
});
