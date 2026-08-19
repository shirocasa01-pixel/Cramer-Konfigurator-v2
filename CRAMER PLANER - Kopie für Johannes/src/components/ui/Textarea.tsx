import { useId, type TextareaHTMLAttributes } from 'react'
import styles from './Textarea.module.css'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  hint?: string
}

/** Mehrzeiliges Eingabefeld – ausschließlich für die Sonderausstattung (Phase 5). */
export function Textarea({ label, hint, id, className, ...rest }: TextareaProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={fieldId}>
        {label}
      </label>
      <textarea
        id={fieldId}
        className={[styles.textarea, className].filter(Boolean).join(' ')}
        rows={4}
        {...rest}
      />
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </div>
  )
}
