import { useState, useCallback } from 'react';

export interface UndoRedoState<T> {
  current: T;
  canUndo: boolean;
  canRedo: boolean;
  set: (value: T) => void;
  undo: () => void;
  redo: () => void;
  reset: (value: T) => void;
}

export function useUndoRedo<T>(initial: T, maxHistory = 50): UndoRedoState<T> {
  const [past, setPast] = useState<T[]>([]);
  const [present, setPresent] = useState<T>(initial);
  const [future, setFuture] = useState<T[]>([]);

  const set = useCallback((value: T) => {
    setPast(prev => [...prev.slice(-(maxHistory - 1)), present]);
    setPresent(value);
    setFuture([]);
  }, [present, maxHistory]);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setPast(prev => prev.slice(0, -1));
    setFuture(prev => [present, ...prev]);
    setPresent(previous);
  }, [past, present]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture(prev => prev.slice(1));
    setPast(prev => [...prev, present]);
    setPresent(next);
  }, [future, present]);

  const reset = useCallback((value: T) => {
    setPast([]);
    setFuture([]);
    setPresent(value);
  }, []);

  return {
    current: present,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    set,
    undo,
    redo,
    reset,
  };
}
