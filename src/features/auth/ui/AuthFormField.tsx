import type {
  ChangeEventHandler,
  HTMLInputAutoCompleteAttribute,
  HTMLInputTypeAttribute,
} from 'react';

interface AuthFormFieldProps {
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

/** 인증 폼의 label, input, 상태 안내를 접근성 속성으로 연결한다. */
export function AuthFormField({
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
}: AuthFormFieldProps) {
  const message = error ?? successText ?? helperText;
  const messageId = `${id}-message`;
  const messageTone = error ? 'error' : successText ? 'success' : 'helper';

  return (
    <div className="auth-field">
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
        <p id={messageId} className={`field-message field-message--${messageTone}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
