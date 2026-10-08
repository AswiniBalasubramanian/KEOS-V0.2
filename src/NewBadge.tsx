import { useEffect, useState } from 'react'
import { MetalBadge } from 'metal-fx'

/* Follows the app theme (data-theme on <html>) so the metal picks its light or dark tuning. */
function useAppTheme(): 'light' | 'dark' {
  const read = () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light')
  const [theme, setTheme] = useState<'light' | 'dark'>(read)
  useEffect(() => {
    const obs = new MutationObserver(() => setTheme(read()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return theme
}

/* A liquid-metal "New" badge for features that just shipped. Keep these apart: one per area. */
export default function NewBadge({ scale = 0.8 }: { scale?: number }) {
  const theme = useAppTheme()
  return (
    <span className="new-badge" role="img" aria-label="New">
      <MetalBadge theme={theme} scale={scale} strength={0.9}>
        New
      </MetalBadge>
    </span>
  )
}
