import type { ChangeEventHandler, HTMLInputAutoCompleteAttribute, HTMLInputTypeAttribute } from 'react';

interface AuthFormFieldProps {
  id: string;
  label: string;
  type: HTMLInputTypeAttribute;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  error?: string;
  autoComplete: HTMLInputAutoCompleteAttribute;
}

/** 인증 폼의 label, input, 오류 설명을 접근성 속성으로 연결한다. */
export function AuthFormField({
  id,
  label,
  type,
  value,
  onChange,
  error,
  autoComplete,
}: AuthFormFieldProps) {
  const errorId = `${id}-error`;

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
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      {error ? (
        <p id={errorId} className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
