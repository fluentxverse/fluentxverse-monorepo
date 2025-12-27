/**
 * Undo/Redo Hook
 * Provides undo/redo functionality for any state with configurable history size
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'preact/hooks';

export interface UndoRedoOptions {
  maxHistory?: number;          // Maximum number of history states (default: 50)
  debounceMs?: number;          // Debounce time for rapid changes (default: 300)
  compareStates?: (a: any, b: any) => boolean; // Custom comparison function
}

export interface UndoRedoState<T> {
  past: T[];
  present: T;
  future: T[];
}

export interface UndoRedoActions<T> {
  set: (newState: T, description?: string) => void;  // Set new state (adds to history)
  replace: (newState: T) => void;                     // Replace current without adding to history
  undo: () => void;
  redo: () => void;
  reset: (initialState: T) => void;
  canUndo: boolean;
  canRedo: boolean;
  currentIndex: number;
  historyLength: number;
  lastAction: 'undo' | 'redo' | 'set' | 'reset' | null;
}

// Default state comparator (deep equality check for simple objects)
const defaultCompare = (a: any, b: any): boolean => {
  return JSON.stringify(a) === JSON.stringify(b);
};

/**
 * Hook for undo/redo functionality
 */
export function useUndoRedo<T>(
  initialState: T,
  options: UndoRedoOptions = {}
): [T, UndoRedoActions<T>] {
  const {
    maxHistory = 50,
    debounceMs = 300,
    compareStates = defaultCompare,
  } = options;

  const [state, setState] = useState<UndoRedoState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  const [lastAction, setLastAction] = useState<'undo' | 'redo' | 'set' | 'reset' | null>(null);
  
  // Debounce timer ref
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingStateRef = useRef<T | null>(null);

  // Set new state with history
  const set = useCallback((newState: T, description?: string) => {
    // Clear any pending debounced update
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Store pending state
    pendingStateRef.current = newState;

    // Debounce the history update
    debounceTimerRef.current = setTimeout(() => {
      setState(currentState => {
        const pendingState = pendingStateRef.current;
        if (pendingState === null) return currentState;
        
        // Don't add to history if state hasn't changed
        if (compareStates(currentState.present, pendingState)) {
          return currentState;
        }

        // Calculate new past (limit to maxHistory)
        const newPast = [...currentState.past, currentState.present].slice(-maxHistory);

        pendingStateRef.current = null;
        
        return {
          past: newPast,
          present: pendingState,
          future: [], // Clear future on new action
        };
      });
      setLastAction('set');
    }, debounceMs);

    // Immediately update present for responsiveness
    setState(currentState => ({
      ...currentState,
      present: newState,
    }));
  }, [maxHistory, debounceMs, compareStates]);

  // Replace current state without adding to history
  const replace = useCallback((newState: T) => {
    // Clear any pending debounced update
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      pendingStateRef.current = null;
    }

    setState(currentState => ({
      ...currentState,
      present: newState,
    }));
  }, []);

  // Undo
  const undo = useCallback(() => {
    setState(currentState => {
      if (currentState.past.length === 0) return currentState;

      const previous = currentState.past[currentState.past.length - 1];
      const newPast = currentState.past.slice(0, -1);

      return {
        past: newPast,
        present: previous,
        future: [currentState.present, ...currentState.future],
      };
    });
    setLastAction('undo');
  }, []);

  // Redo
  const redo = useCallback(() => {
    setState(currentState => {
      if (currentState.future.length === 0) return currentState;

      const next = currentState.future[0];
      const newFuture = currentState.future.slice(1);

      return {
        past: [...currentState.past, currentState.present],
        present: next,
        future: newFuture,
      };
    });
    setLastAction('redo');
  }, []);

  // Reset to initial state
  const reset = useCallback((newInitialState: T) => {
    // Clear any pending updates
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      pendingStateRef.current = null;
    }

    setState({
      past: [],
      present: newInitialState,
      future: [],
    });
    setLastAction('reset');
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y for redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const actions = useMemo<UndoRedoActions<T>>(() => ({
    set,
    replace,
    undo,
    redo,
    reset,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    currentIndex: state.past.length,
    historyLength: state.past.length + 1 + state.future.length,
    lastAction,
  }), [set, replace, undo, redo, reset, state.past.length, state.future.length, lastAction]);

  return [state.present, actions];
}

/**
 * Hook for undo/redo with external state management
 * Use this when you need to integrate with existing state
 */
export function useUndoRedoExternal<T>(
  currentState: T,
  onChange: (newState: T) => void,
  options: UndoRedoOptions = {}
): Omit<UndoRedoActions<T>, 'set' | 'replace'> & {
  pushState: (newState: T) => void;
  undo: () => void;
  redo: () => void;
} {
  const {
    maxHistory = 50,
    compareStates = defaultCompare,
  } = options;

  const historyRef = useRef<{ past: T[]; future: T[] }>({ past: [], future: [] });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const lastStateRef = useRef<T>(currentState);

  const pushState = useCallback((newState: T) => {
    if (compareStates(lastStateRef.current, newState)) return;

    historyRef.current.past = [...historyRef.current.past, lastStateRef.current].slice(-maxHistory);
    historyRef.current.future = [];
    lastStateRef.current = newState;

    setCanUndo(historyRef.current.past.length > 0);
    setCanRedo(false);
    
    onChange(newState);
  }, [maxHistory, compareStates, onChange]);

  const undo = useCallback(() => {
    if (historyRef.current.past.length === 0) return;

    const previous = historyRef.current.past[historyRef.current.past.length - 1];
    historyRef.current.past = historyRef.current.past.slice(0, -1);
    historyRef.current.future = [lastStateRef.current, ...historyRef.current.future];
    lastStateRef.current = previous;

    setCanUndo(historyRef.current.past.length > 0);
    setCanRedo(true);
    
    onChange(previous);
  }, [onChange]);

  const redo = useCallback(() => {
    if (historyRef.current.future.length === 0) return;

    const next = historyRef.current.future[0];
    historyRef.current.past = [...historyRef.current.past, lastStateRef.current];
    historyRef.current.future = historyRef.current.future.slice(1);
    lastStateRef.current = next;

    setCanUndo(true);
    setCanRedo(historyRef.current.future.length > 0);
    
    onChange(next);
  }, [onChange]);

  const reset = useCallback((initialState: T) => {
    historyRef.current = { past: [], future: [] };
    lastStateRef.current = initialState;
    setCanUndo(false);
    setCanRedo(false);
    onChange(initialState);
  }, [onChange]);

  return {
    pushState,
    undo,
    redo,
    reset,
    canUndo,
    canRedo,
    currentIndex: historyRef.current.past.length,
    historyLength: historyRef.current.past.length + 1 + historyRef.current.future.length,
    lastAction: null,
  };
}

export default useUndoRedo;
