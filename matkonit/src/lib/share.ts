import { toast } from './toast'

/** Native share sheet where there is one (phones), WhatsApp everywhere else — it's how Israel shares a list. */
export async function shareText(title: string, text: string) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text })
      return
    } catch (error) {
      if ((error as Error).name === 'AbortError') return
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast('הועתק', 'good')
  } catch {
    toast('לא הצלחנו להעתיק', 'error')
  }
}
