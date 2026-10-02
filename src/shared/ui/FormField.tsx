import {
  useState,
  type ChangeEventHandler,
  type FocusEventHandler,
  type HTMLInputAutoCompleteAttribute,
  type HTMLInputTypeAttribute,
} from 'react';

interface FormFieldProps {
  id: string;
  label: string;
  type: HTMLInputTypeAttribute;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  onBlur?: FocusEventHandler<HTMLInputElement>;
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
  onBlur,
  error,
  helperText,
  successText,
  placeholder,
  maxLength,
  autoComplete,
}: FormFieldProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const message = error ?? successText ?? helperText;
  const messageId = `${id}-message`;
  const messageTone = error ? 'error' : successText ? 'success' : 'helper';
  const isPassword = type === 'password';

  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <div
        className={`form-field-input-wrap${isPassword ? ' form-field-input-wrap--password' : ''}`}
      >
        <input
          id={id}
          name={id}
          type={isPassword && isPasswordVisible ? 'text' : type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          autoComplete={autoComplete}
          placeholder={placeholder}
          maxLength={maxLength}
          aria-invalid={Boolean(error)}
          aria-describedby={message ? messageId : undefined}
        />
        {isPassword ? (
          <button
            aria-label={isPasswordVisible ? '비밀번호 숨기기' : '비밀번호 보기'}
            aria-pressed={isPasswordVisible}
            className="form-field-password-toggle"
            type="button"
            onClick={() => setIsPasswordVisible((visible) => !visible)}
          >
            {isPasswordVisible ? (
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" />
                <path d="M9.9 5.2A10.8 10.8 0 0112 5c5.1 0 8.6 4.5 9.5 6-.4.7-1.4 2.1-3.3 3.4M6.2 6.2C4.1 7.5 2.8 9.5 2.5 11c.9 1.5 4.4 6 9.5 6 1 0 1.9-.2 2.7-.5" />
              </svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        ) : null}
      </div>
      <p
        id={messageId}
        aria-hidden={!message}
        className={`form-field-message form-field-message--${messageTone}`}
      >
        {message || '\u00a0'}
      </p>
    </div>
  );
}
