import { useEffect, useState } from 'react'

/** Ease-out count for numeric stats. */
export function useCountUp(target, { duration = 700, enabled = true } = {}) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!enabled) return
    const end = typeof target === 'number' ? target : Number.parseInt(String(target), 10) || 0
    if (end <= 0) {
      setValue(0)
      return
    }
    const startAt = performance.now()
    let raf
    const tick = (now) => {
      const t = Math.min(1, (now - startAt) / duration)
      const eased = 1 - (1 - t) ** 3
      setValue(Math.round(end * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, enabled])

  return value
}
