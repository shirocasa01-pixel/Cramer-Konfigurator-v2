import styles from './BrandMark.module.css'

interface BrandMarkProps {
  size?: 'md' | 'lg'
}

/** Wortmarke „CRAMER PLANER“ mit Luxus-Sperrung (Letter-Spacing). */
export function BrandMark({ size = 'md' }: BrandMarkProps) {
  return (
    <div className={[styles.brand, styles[size]].join(' ')} aria-label="CRAMER PLANER">
      <span className={styles.cramer}>CRAMER</span>
      <span className={styles.planer}>PLANER</span>
    </div>
  )
}
