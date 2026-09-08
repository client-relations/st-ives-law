import { useEffect, useRef, useCallback } from 'react';
import { calculateFormProgress } from '../utils/calculateProgress';

const DEBOUNCE_MS = 3000; // Auto-save every 3 seconds

export function useAutoSaveSupabase(
  formId: string | null,
  aData: any,
  bData: any,
  cData: any,
  dData: any,
  onSave: (formData: any, progress: number) => Promise<void>,
) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>('');

  const saveToSupabase = useCallback(async () => {
    if (!formId) return;

    const formData = {
      aData,
      bData,
      cData,
      dData,
    };

    const currentDataStr = JSON.stringify(formData);

    // Only save if data has changed
    if (currentDataStr === lastSavedRef.current) {
      return;
    }

    lastSavedRef.current = currentDataStr;

    try {
      const progress = calculateFormProgress(aData, bData, cData, dData);
      await onSave(formData, progress);
    } catch (err) {
      console.error('Error auto-saving form:', err);
      // Don't throw - auto-save should be silent
    }
  }, [formId, aData, bData, cData, dData, onSave]);

  // Debounced auto-save
  useEffect(() => {
    if (!formId) return;

    // Clear existing timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Set new timer
    saveTimerRef.current = setTimeout(() => {
      saveToSupabase();
    }, DEBOUNCE_MS);

    // Cleanup
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [formId, aData, bData, cData, dData, saveToSupabase]);

  // Save on unmount (before user leaves)
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      // Force final save
      saveToSupabase();
    };
  }, [saveToSupabase]);

  return {
    saveNow: saveToSupabase, // Manual save trigger
  };
}
