/**
 * Form Validation Hook
 * Provides real-time inline form validation with customizable rules
 */

import { useState, useCallback, useMemo } from 'preact/hooks';

// Validation rule types
export type ValidationRule = {
  required?: boolean | string; // true or custom message
  minLength?: number | { value: number; message: string };
  maxLength?: number | { value: number; message: string };
  pattern?: RegExp | { value: RegExp; message: string };
  email?: boolean | string;
  phone?: boolean | string;
  date?: boolean | string;
  min?: number | { value: number; message: string };
  max?: number | { value: number; message: string };
  match?: { field: string; message?: string }; // Match another field (e.g., confirm password)
  custom?: (value: any, formData: Record<string, any>) => string | null; // Custom validator
};

export type ValidationSchema<T> = {
  [K in keyof T]?: ValidationRule;
};

export type ValidationErrors<T> = {
  [K in keyof T]?: string;
};

export type TouchedFields<T> = {
  [K in keyof T]?: boolean;
};

// Common validation patterns
export const patterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/,
  alphanumeric: /^[a-zA-Z0-9]*$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
  url: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
};

// Validate a single field
function validateField(
  name: string,
  value: any,
  rule: ValidationRule,
  formData: Record<string, any>
): string | null {
  const stringValue = value?.toString() || '';

  // Required check
  if (rule.required) {
    const isEmpty = value === undefined || value === null || stringValue.trim() === '';
    if (isEmpty) {
      return typeof rule.required === 'string' 
        ? rule.required 
        : `This field is required`;
    }
  }

  // Skip other validations if empty and not required
  if (!value && !rule.required) return null;

  // Min length
  if (rule.minLength) {
    const min = typeof rule.minLength === 'number' ? rule.minLength : rule.minLength.value;
    const msg = typeof rule.minLength === 'object' ? rule.minLength.message : `Minimum ${min} characters`;
    if (stringValue.length < min) return msg;
  }

  // Max length
  if (rule.maxLength) {
    const max = typeof rule.maxLength === 'number' ? rule.maxLength : rule.maxLength.value;
    const msg = typeof rule.maxLength === 'object' ? rule.maxLength.message : `Maximum ${max} characters`;
    if (stringValue.length > max) return msg;
  }

  // Pattern
  if (rule.pattern) {
    const regex = rule.pattern instanceof RegExp ? rule.pattern : rule.pattern.value;
    const msg = rule.pattern instanceof RegExp ? 'Invalid format' : rule.pattern.message;
    if (!regex.test(stringValue)) return msg;
  }

  // Email
  if (rule.email) {
    const msg = typeof rule.email === 'string' ? rule.email : 'Invalid email address';
    if (!patterns.email.test(stringValue)) return msg;
  }

  // Phone
  if (rule.phone) {
    const msg = typeof rule.phone === 'string' ? rule.phone : 'Invalid phone number';
    if (!patterns.phone.test(stringValue)) return msg;
  }

  // Date
  if (rule.date) {
    const msg = typeof rule.date === 'string' ? rule.date : 'Invalid date';
    const date = new Date(stringValue);
    if (isNaN(date.getTime())) return msg;
  }

  // Min number
  if (rule.min !== undefined) {
    const min = typeof rule.min === 'number' ? rule.min : rule.min.value;
    const msg = typeof rule.min === 'object' ? rule.min.message : `Minimum value is ${min}`;
    if (parseFloat(stringValue) < min) return msg;
  }

  // Max number
  if (rule.max !== undefined) {
    const max = typeof rule.max === 'number' ? rule.max : rule.max.value;
    const msg = typeof rule.max === 'object' ? rule.max.message : `Maximum value is ${max}`;
    if (parseFloat(stringValue) > max) return msg;
  }

  // Match another field
  if (rule.match) {
    const otherValue = formData[rule.match.field];
    if (value !== otherValue) {
      return rule.match.message || `Must match ${rule.match.field}`;
    }
  }

  // Custom validator
  if (rule.custom) {
    return rule.custom(value, formData);
  }

  return null;
}

/**
 * Form validation hook
 */
export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  schema: ValidationSchema<T>
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<ValidationErrors<T>>({});
  const [touched, setTouched] = useState<TouchedFields<T>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate a single field
  const validateSingleField = useCallback(
    (name: keyof T, value: any): string | null => {
      const rule = schema[name];
      if (!rule) return null;
      return validateField(name as string, value, rule, values);
    },
    [schema, values]
  );

  // Validate all fields
  const validateAll = useCallback((): boolean => {
    const newErrors: ValidationErrors<T> = {};
    let isValid = true;

    for (const key of Object.keys(schema) as Array<keyof T>) {
      const error = validateSingleField(key, values[key]);
      if (error) {
        newErrors[key] = error;
        isValid = false;
      }
    }

    setErrors(newErrors);
    // Mark all fields as touched
    const allTouched: TouchedFields<T> = {};
    for (const key of Object.keys(schema) as Array<keyof T>) {
      allTouched[key] = true;
    }
    setTouched(allTouched);

    return isValid;
  }, [schema, values, validateSingleField]);

  // Handle field change
  const handleChange = useCallback(
    (name: keyof T) => (e: Event | any) => {
      const target = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      const newValue = target.type === 'checkbox' 
        ? (target as HTMLInputElement).checked 
        : target.value;

      setValues(prev => {
        const updated = { ...prev, [name]: newValue };
        
        // Validate on change if field was touched
        if (touched[name]) {
          const error = validateField(name as string, newValue, schema[name] || {}, updated);
          setErrors(prevErrors => ({
            ...prevErrors,
            [name]: error || undefined,
          }));
        }
        
        return updated;
      });
    },
    [schema, touched]
  );

  // Handle field blur (mark as touched and validate)
  const handleBlur = useCallback(
    (name: keyof T) => () => {
      setTouched(prev => ({ ...prev, [name]: true }));
      const error = validateSingleField(name, values[name]);
      setErrors(prev => ({
        ...prev,
        [name]: error || undefined,
      }));
    },
    [values, validateSingleField]
  );

  // Set value directly (for custom components)
  const setValue = useCallback(
    (name: keyof T, value: any) => {
      setValues(prev => ({ ...prev, [name]: value }));
      if (touched[name]) {
        const error = validateField(name as string, value, schema[name] || {}, { ...values, [name]: value });
        setErrors(prev => ({
          ...prev,
          [name]: error || undefined,
        }));
      }
    },
    [schema, touched, values]
  );

  // Set multiple values at once
  const setMultipleValues = useCallback(
    (newValues: Partial<T>) => {
      setValues(prev => ({ ...prev, ...newValues }));
    },
    []
  );

  // Reset form
  const reset = useCallback(
    (newValues?: T) => {
      setValues(newValues || initialValues);
      setErrors({});
      setTouched({});
      setIsSubmitting(false);
    },
    [initialValues]
  );

  // Clear field error
  const clearError = useCallback((name: keyof T) => {
    setErrors(prev => {
      const updated = { ...prev };
      delete updated[name];
      return updated;
    });
  }, []);

  // Set custom error
  const setError = useCallback((name: keyof T, message: string) => {
    setErrors(prev => ({ ...prev, [name]: message }));
    setTouched(prev => ({ ...prev, [name]: true }));
  }, []);

  // Check if form is valid (no errors)
  const isValid = useMemo(() => {
    return Object.keys(errors).length === 0;
  }, [errors]);

  // Check if form is dirty (values changed from initial)
  const isDirty = useMemo(() => {
    return JSON.stringify(values) !== JSON.stringify(initialValues);
  }, [values, initialValues]);

  // Handle form submit
  const handleSubmit = useCallback(
    (onSubmit: (values: T) => Promise<void> | void) => async (e: Event) => {
      e.preventDefault();
      
      if (!validateAll()) return;
      
      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, validateAll]
  );

  // Get field props helper
  const getFieldProps = useCallback(
    (name: keyof T) => ({
      name,
      value: values[name] ?? '',
      onChange: handleChange(name),
      onBlur: handleBlur(name),
      'aria-invalid': !!errors[name],
      'aria-describedby': errors[name] ? `${String(name)}-error` : undefined,
    }),
    [values, errors, handleChange, handleBlur]
  );

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    isDirty,
    handleChange,
    handleBlur,
    setValue,
    setMultipleValues,
    setError,
    clearError,
    reset,
    validateAll,
    handleSubmit,
    getFieldProps,
    setIsSubmitting,
  };
}

export default useFormValidation;
