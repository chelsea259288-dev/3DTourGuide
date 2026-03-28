import { useEffect, useState } from 'react'

/** Cap pixel ratio on small screens to keep WebGL budgets predictable */
export function useAdaptiveDpr(): [number, number] {
  const [dpr, setDpr] = useState<[number, number]>([1, 2])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const update = () => {
      const coarse = window.matchMedia('(pointer: coarse)').matches
      const mobile = mq.matches || coarse
      const max = mobile ? 1.35 : 2
      setDpr([1, Math.min(window.devicePixelRatio, max)])
    }
    update()
    mq.addEventListener('change', update)
    window.addEventListener('resize', update)
    return () => {
      mq.removeEventListener('change', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return dpr
}
