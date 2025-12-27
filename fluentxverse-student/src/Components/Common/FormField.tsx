/**
 * FormField Component
 * Reusable form field with inline validation and error display
 */

import { h, JSX, ComponentChildren } from 'preact';
import './FormField.css';

interface FormFieldProps {
  name: string;
  label?: string;
  type?: 'text' | 'email' | 'password' | 'tel' | 'number' | 'date' | 'textarea' | 'select';
  placeholder?: string;
  value?: string | number;
  error?: string;
  touched?: boolean;
  disabled?: boolean;
  required?: boolean;
  autoComplete?: string;
  icon?: string; // Remix icon class
  hint?: string;
  children?: ComponentChildren; // For select options
  rows?: number; // For textarea
  min?: string | number;
  max?: string | number;
  step?: string | number;
  className?: string;
  inputClassName?: string;
  onChange?: (e: Event) => void;
  onBlur?: (e: Event) => void;
  onFocus?: (e: Event) => void;
}

export function FormField({
  name,
  label,
  type = 'text',
  placeholder,
  value,
  error,
  touched,
  disabled,
  required,
  autoComplete,
  icon,
  hint,
  children,
  rows = 3,
  min,
  max,
  step,
  className = '',
  inputClassName = '',
  onChange,
  onBlur,
  onFocus,
}: FormFieldProps) {
  const hasError = touched && !!error;
  const showError = hasError;
  
  const fieldId = `field-${name}`;
  const errorId = `${name}-error`;
  
  const inputProps = {
    id: fieldId,
    name,
    value: value ?? '',
    disabled,
    placeholder,
    autoComplete,
    min,
    max,
    step,
    onChange,
    onBlur,
    onFocus,
    'aria-invalid': hasError,
    'aria-describedby': hasError ? errorId : undefined,
    'aria-required': required,
    className: `form-field-input ${inputClassName} ${hasError ? 'has-error' : ''} ${icon ? 'has-icon' : ''}`,
  };

  const renderInput = () => {
    if (type === 'textarea') {
      return (
        <textarea
          {...inputProps}
          rows={rows}
        />
      );
    }
    
    if (type === 'select') {
      return (
        <select {...inputProps}>
          {children}
        </select>
      );
    }
    
    return (
      <input
        {...inputProps}
        type={type}
      />
    );
  };

  return (
    <div className={`form-field ${className} ${hasError ? 'form-field-error' : ''}`}>
      {label && (
        <label htmlFor={fieldId} className="form-field-label">
          {label}
          {required && <span className="form-field-required">*</span>}
        </label>
      )}
      
      <div className="form-field-input-wrapper">
        {icon && (
          <span className="form-field-icon">
            <i className={icon} />
          </span>
        )}
        
        {renderInput()}
        
        {hasError && (
          <span className="form-field-error-icon">
            <i className="ri-error-warning-line" />
          </span>
        )}
        
        {!hasError && touched && value && (
          <span className="form-field-success-icon">
            <i className="ri-check-line" />
          </span>
        )}
      </div>
      
      {showError && (
        <span id={errorId} className="form-field-error-message" role="alert">
          <i className="ri-error-warning-line" />
          {error}
        </span>
      )}
      
      {hint && !showError && (
        <span className="form-field-hint">
          {hint}
        </span>
      )}
    </div>
  );
}

// Password field with show/hide toggle
interface PasswordFieldProps extends Omit<FormFieldProps, 'type'> {
  showPassword?: boolean;
  onTogglePassword?: () => void;
}

export function PasswordField({
  showPassword = false,
  onTogglePassword,
  ...props
}: PasswordFieldProps) {
  const hasError = props.touched && !!props.error;
  const fieldId = `field-${props.name}`;
  const errorId = `${props.name}-error`;

  return (
    <div className={`form-field ${props.className || ''} ${hasError ? 'form-field-error' : ''}`}>
      {props.label && (
        <label htmlFor={fieldId} className="form-field-label">
          {props.label}
          {props.required && <span className="form-field-required">*</span>}
        </label>
      )}
      
      <div className="form-field-input-wrapper">
        {props.icon && (
          <span className="form-field-icon">
            <i className={props.icon} />
          </span>
        )}
        
        <input
          id={fieldId}
          name={props.name}
          type={showPassword ? 'text' : 'password'}
          value={props.value ?? ''}
          disabled={props.disabled}
          placeholder={props.placeholder}
          autoComplete={props.autoComplete}
          onChange={props.onChange}
          onBlur={props.onBlur}
          onFocus={props.onFocus}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : undefined}
          aria-required={props.required}
          className={`form-field-input ${props.inputClassName || ''} ${hasError ? 'has-error' : ''} ${props.icon ? 'has-icon' : ''} has-toggle`}
        />
        
        {onTogglePassword && (
          <button
            type="button"
            className="form-field-toggle"
            onClick={onTogglePassword}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            <i className={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} />
          </button>
        )}
      </div>
      
      {hasError && (
        <span id={errorId} className="form-field-error-message" role="alert">
          <i className="ri-error-warning-line" />
          {props.error}
        </span>
      )}
      
      {props.hint && !hasError && (
        <span className="form-field-hint">
          {props.hint}
        </span>
      )}
    </div>
  );
}

export default FormField;
