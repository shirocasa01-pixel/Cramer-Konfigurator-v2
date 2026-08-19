import { forwardRef, useId, type SelectHTMLAttributes } from 'react'
import styles from './Select.module.css'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label: string
  options: SelectOption[]
  placeholder?: string
  error?: string
}

/**
 * Natives <select> (schnelle, touch-optimierte Auswahl auf iPad) mit
 * einheitlichem Look. Datenquelle sind stets Optionen aus zentralen Daten/Config.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, placeholder, error, id, className, value, ...rest },
  ref,
) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const isEmpty = value === '' || value === undefined

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={fieldId}>
        {label}
      </label>
      <div className={styles.wrap}>
        <select
          ref={ref}
          id={fieldId}
          className={[
            styles.select,
            error ? styles.selectError : '',
            isEmpty ? styles.placeholder : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          value={value}
          {...rest}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className={styles.chevron} aria-hidden="true">
          ▾
        </span>
      </div>
      {error ? (
        <span id={`${fieldId}-error`} className={styles.error} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  )
})
