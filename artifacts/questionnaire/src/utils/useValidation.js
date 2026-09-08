import { useState } from 'react';

export function useValidation() {
  const [errors, setErrors] = useState([]);

  const hasError = (field) => errors.some(e => e.field === field);
  const getError = (field) => errors.find(e => e.field === field)?.message || null;
  const clearErrors = () => setErrors([]);

  return { errors, setErrors, hasError, getError, clearErrors };
}
