import type {
  ChangeEventHandler,
  HTMLInputAutoCompleteAttribute,
  HTMLInputTypeAttribute,
} from 'react';

interface FormFieldProps {
  id: string;
  label: string;
  type: HTMLInputTypeAttribute;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  error?: string;
  helperText?: string;
  successText?: string;
  placeholder?: string;
  maxLength?: number;
  autoComplete: HTMLInputAutoCompleteAttribute;
}

/** 입력 label과 상태 설명을 접근 가능한 하나의 필드로 조립한다. */
export function FormField({
  id,
  label,
  type,
  value,
  onChange,
  error,
  helperText,
  successText,
  placeholder,
  maxLength,
  autoComplete,
}: FormFieldProps) {
  const message = error ?? successText ?? helperText;
  const messageId = `${id}-message`;
  const messageTone = error ? 'error' : successText ? 'success' : 'helper';

  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        aria-describedby={message ? messageId : undefined}
      />
      {message ? (
        <p id={messageId} className={`form-field-message form-field-message--${messageTone}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
