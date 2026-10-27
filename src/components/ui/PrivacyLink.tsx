import { useI18n } from '../../i18n'

/**
 * The public privacy policy (public/privacy.html) — a plain page that needs no account and no
 * JavaScript, opened in a new tab so the app keeps its place. Jumps to the current language.
 */
export function PrivacyLink({ className = '' }: { className?: string }) {
  const { t, lang } = useI18n()
  return (
    <a
      href={`${import.meta.env.BASE_URL}privacy.html#${lang === 'zh' ? 'zh' : 'en'}`}
      target="_blank" rel="noopener"
      className={`underline decoration-faint underline-offset-4 transition-colors hover:text-ink ${className}`}
    >
      {t('privacy.link')}
    </a>
  )
}
