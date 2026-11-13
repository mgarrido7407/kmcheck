import type { DiagnosticResponse } from '@kmcheck/shared';
import { useCallback, useState } from 'react';

const STORAGE_KEY = 'kmcheck:history:v1';
const MAX_ENTRIES = 8;

function readStoredHistory(): DiagnosticResponse[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DiagnosticResponse[]) : [];
  } catch {
    return [];
  }
}

function writeStoredHistory(items: DiagnosticResponse[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignorar errores de cuota o modo privado sin almacenamiento.
  }
}

export function useDiagnosticHistory() {
  const [history, setHistory] = useState<DiagnosticResponse[]>(readStoredHistory);

  const addEntry = useCallback((entry: DiagnosticResponse) => {
    setHistory((prev) => {
      const next = [entry, ...prev.filter((item) => item.generatedAt !== entry.generatedAt)].slice(0, MAX_ENTRIES);
      writeStoredHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignorar si localStorage no está disponible.
    }
  }, []);

  return { history, addEntry, clearHistory };
}
