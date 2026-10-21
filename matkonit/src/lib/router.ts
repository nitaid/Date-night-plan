import { useEffect, useState } from 'react'

/** Tiny hash router: #/recipe/abc → ['recipe', 'abc']. Hash routes survive the static host and the PWA shell. */
export function useRoute() {
  const read = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
  const [route, setRoute] = useState<string[]>(read)
  useEffect(() => {
    const onChange = () => {
      setRoute(read())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export function go(...parts: string[]) {
  window.location.hash = `/${parts.map(encodeURIComponent).join('/')}`
}

export function back(fallback = '') {
  if (window.history.length > 1) window.history.back()
  else go(fallback)
}

/**
 * The Web Share Target in the manifest opens /share?url=…&text=…&title=….
 * TikTok and Instagram usually put the link inside `text`, so read all three.
 */
export function takeSharedPayload(): string | null {
  const url = new URL(window.location.href)
  if (url.pathname !== '/share' && !url.searchParams.has('shared')) return null
  const payload = [url.searchParams.get('url'), url.searchParams.get('text'), url.searchParams.get('title')].filter(Boolean).join('\n')
  window.history.replaceState(null, '', '/#/import')
  return payload || null
}
