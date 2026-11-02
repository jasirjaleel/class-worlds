"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "cw-current-class";

export type ClassSummary = { id: string; name: string };

function remembered(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** The signed-in teacher's classes and the one they're working with: the last used, otherwise the first. */
export function useCurrentClass() {
  const [data, setData] = useState<{ signedIn: boolean; classes: ClassSummary[] } | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  const reload = useCallback(
    () =>
      fetch("/api/classes")
        .then((res) => (res.ok ? res.json() : { signedIn: false, classes: [] }))
        .catch(() => ({ signedIn: false, classes: [] }))
        .then((next) => {
          setData(next);
          setChosen(remembered());
        }),
    [],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  const select = useCallback((id: string) => {
    setChosen(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // private window: it just won't be remembered next time
    }
  }, []);

  const classes = data?.classes ?? [];
  const classId = classes.find((c) => c.id === chosen)?.id ?? classes[0]?.id ?? null;
  return { loading: !data, signedIn: data?.signedIn ?? false, classes, classId, select, reload };
}
