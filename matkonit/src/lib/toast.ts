type Tone = 'info' | 'good' | 'error'
type Listener = (toast: { id: string; message: string; tone: Tone }) => void

const listeners = new Set<Listener>()

export function toast(message: string, tone: Tone = 'info') {
  const item = { id: `${Date.now()}-${Math.random()}`, message, tone }
  listeners.forEach((listener) => listener(item))
}

export function onToast(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
