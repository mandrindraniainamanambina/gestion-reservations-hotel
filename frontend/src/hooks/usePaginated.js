import { useCallback, useEffect, useRef, useState } from "react";

export const PAGE_SIZE = 10;

// Charge une liste paginée ; revient à la page 1 quand les filtres changent.
export default function usePaginated(fetcher, filters) {
  const cle = JSON.stringify(filters);
  const [etatPage, setEtatPage] = useState({ cle, page: 1 });
  const page = etatPage.cle === cle ? etatPage.page : 1;
  const [data, setData] = useState({ results: [], count: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const dernier = useRef(0);

  useEffect(() => {
    const id = ++dernier.current;
    setLoading(true);
    fetcher({ ...JSON.parse(cle), page })
      .then((d) => {
        if (id !== dernier.current) return; // réponse périmée ignorée
        setData(d);
        setError("");
      })
      .catch((e) => id === dernier.current && setError(e.message))
      .finally(() => id === dernier.current && setLoading(false));
  }, [fetcher, cle, page, version]);

  const setPage = useCallback((p) => setEtatPage({ cle, page: p }), [cle]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...data, loading, error, page, setPage, reload };
}
