import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
/**
 * FormField Component
 * Reusable form field with inline validation and error display
 */
import { JSX } from "solid-js";
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
    children?: JSX.Element; // For select options
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
export function FormField(_props0: FormFieldProps) {
    const hasError = createMemo(() => _props0["touched"] && !!_props0["error"]);
    const showError = createMemo(() => hasError());
    const fieldId = createMemo(() => `field-${_props0["name"]}`);
    const errorId = createMemo(() => `${_props0["name"]}-error`);
    const inputProps = {
        get id() {
            return fieldId();
        },
        get name() {
            return _props0["name"];
        },
        get value() {
            return _props0["value"] ?? '';
        },
        get disabled() {
            return _props0["disabled"];
        },
        get placeholder() {
            return _props0["placeholder"];
        },
        get autoComplete() {
            return _props0["autoComplete"];
        },
        get min() {
            return _props0["min"];
        },
        get max() {
            return _props0["max"];
        },
        get step() {
            return _props0["step"];
        },
        get onChange() {
            return _props0["onChange"];
        },
        get onBlur() {
            return _props0["onBlur"];
        },
        get onFocus() {
            return _props0["onFocus"];
        },
        get 'aria-invalid'() {
            return hasError();
        },
        get 'aria-describedby'() {
            return hasError() ? errorId() : undefined;
        },
        get 'aria-required'() {
            return _props0["required"];
        },
        get className() {
            return `form-field-input ${_props0["inputClassName"] === undefined ? '' : _props0["inputClassName"]} ${hasError() ? 'has-error' : ''} ${_props0["icon"] ? 'has-icon' : ''}`;
        }
    };
    const renderInput = () => {
        if ((_props0["type"] === undefined ? 'text' : _props0["type"]) === 'textarea') {
            return (<textarea {...inputProps} rows={_props0["rows"] === undefined ? 3 : _props0["rows"]}/>);
        }
        if ((_props0["type"] === undefined ? 'text' : _props0["type"]) === 'select') {
            return (<select {...inputProps}>
          {_props0["children"]}
        </select>);
        }
        return (<input {...inputProps} type={_props0["type"] === undefined ? 'text' : _props0["type"]}/>);
    };
    return (<div class={`form-field ${_props0["className"] === undefined ? '' : _props0["className"]} ${hasError() ? 'form-field-error' : ''}`}>
      {_props0["label"] && (<label for={fieldId()} class="form-field-label">
          {_props0["label"]}
          {_props0["required"] && <span class="form-field-required">*</span>}
        </label>)}
      
      <div class="form-field-input-wrapper">
        {_props0["icon"] && (<span class="form-field-icon">
            <i class={_props0["icon"]}/>
          </span>)}
        
        {renderInput()}
        
        {hasError() && (<span class="form-field-error-icon">
            <i class="ri-error-warning-line"/>
          </span>)}
        
        {!hasError() && _props0["touched"] && _props0["value"] && (<span class="form-field-success-icon">
            <i class="ri-check-line"/>
          </span>)}
      </div>
      
      {showError() && (<span id={errorId()} class="form-field-error-message" role="alert">
          <i class="ri-error-warning-line"/>
          {_props0["error"]}
        </span>)}
      
      {_props0["hint"] && !showError() && (<span class="form-field-hint">
          {_props0["hint"]}
        </span>)}
    </div>);
}
// Password field with show/hide toggle
interface PasswordFieldProps extends Omit<FormFieldProps, 'type'> {
    showPassword?: boolean;
    onTogglePassword?: () => void;
}
export function PasswordField(_props1: PasswordFieldProps) {
    const props = splitProps(_props1, ["showPassword", "onTogglePassword"])[1];
    const hasError = props.touched && !!props.error;
    const fieldId = `field-${props.name}`;
    const errorId = `${props.name}-error`;
    return (<div class={`form-field ${props.className || ''} ${hasError ? 'form-field-error' : ''}`}>
      {props.label && (<label for={fieldId} class="form-field-label">
          {props.label}
          {props.required && <span class="form-field-required">*</span>}
        </label>)}
      
      <div class="form-field-input-wrapper">
        {props.icon && (<span class="form-field-icon">
            <i class={props.icon}/>
          </span>)}
        
        <input id={fieldId} name={props.name} type={(_props1["showPassword"] === undefined ? false : _props1["showPassword"]) ? 'text' : 'password'} value={props.value ?? ''} disabled={props.disabled} placeholder={props.placeholder} autocomplete={props.autoComplete} onInput={props.onChange} onBlur={props.onBlur} onFocus={props.onFocus} aria-invalid={hasError} aria-describedby={hasError ? errorId : undefined} aria-required={props.required} class={`form-field-input ${props.inputClassName || ''} ${hasError ? 'has-error' : ''} ${props.icon ? 'has-icon' : ''} has-toggle`}/>
        
        {_props1["onTogglePassword"] && (<button type="button" class="form-field-toggle" onClick={_props1["onTogglePassword"]} aria-label={(_props1["showPassword"] === undefined ? false : _props1["showPassword"]) ? 'Hide password' : 'Show password'}>
            <i class={(_props1["showPassword"] === undefined ? false : _props1["showPassword"]) ? 'ri-eye-off-line' : 'ri-eye-line'}/>
          </button>)}
      </div>
      
      {hasError && (<span id={errorId} class="form-field-error-message" role="alert">
          <i class="ri-error-warning-line"/>
          {props.error}
        </span>)}
      
      {props.hint && !hasError && (<span class="form-field-hint">
          {props.hint}
        </span>)}
    </div>);
}
export default FormField;
