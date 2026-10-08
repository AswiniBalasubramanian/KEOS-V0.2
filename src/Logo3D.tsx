import { useEffect, useRef, useState } from 'react'
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from 'motion/react'

/* Both PNGs are 1264x848 canvases with the icon tile centred; the crop trims the empty margin. */
const IMG_W = 1264
const IMG_H = 848
const VARIANTS = {
  light: { src: '/assets/keos-front-logo.png', crop: { x: 285, y: 80, w: 700, h: 688 } },
  dark: { src: '/assets/keos-front-logo-dark.png', crop: { x: 305, y: 100, w: 650, h: 650 } },
}

const MAX_TILT = 20 // degrees
const REACH = 420 // px from the logo where the tilt reaches its maximum

export default function Logo3D({ size = 80, className = '', theme = 'light' }: { size?: number; className?: string; theme?: 'light' | 'dark' }) {
  const { src: SRC, crop: CROP } = VARIANTS[theme]
  const reduce = useReducedMotion()
  const root = useRef<HTMLButtonElement>(null)
  const [spin, setSpin] = useState(0)

  const nx = useMotionValue(0)
  const ny = useMotionValue(0)
  const rotY = useSpring(nx, { stiffness: 170, damping: 16, mass: 0.6 })
  const rotX = useSpring(ny, { stiffness: 170, damping: 16, mass: 0.6 })
  const gx = useMotionValue(50)
  const gy = useMotionValue(30)
  const glare = useMotionTemplate`radial-gradient(circle at ${gx}% ${gy}%, rgb(255 255 255 / 0.55), transparent 55%)`
  const sx = useSpring(useMotionValue(0), { stiffness: 120, damping: 18 })

  useEffect(() => {
    if (reduce) return
    const onMove = (e: PointerEvent) => {
      const el = root.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const dx = (e.clientX - (r.left + r.width / 2)) / REACH
      const dy = (e.clientY - (r.top + r.height / 2)) / REACH
      const cx = Math.max(-1, Math.min(1, dx))
      const cy = Math.max(-1, Math.min(1, dy))
      nx.set(cx * MAX_TILT)
      ny.set(-cy * MAX_TILT)
      gx.set(50 + cx * 38)
      gy.set(40 + cy * 38)
      sx.set(-cx * 10)
    }
    const onLeave = () => { nx.set(0); ny.set(0); gx.set(50); gy.set(30); sx.set(0) }
    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
    }
  }, [reduce, nx, ny, gx, gy, sx])

  const k = size / CROP.w
  const art = {
    width: size,
    height: size * (CROP.h / CROP.w),
    backgroundImage: `url(${SRC})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${IMG_W * k}px ${IMG_H * k}px`,
    backgroundPosition: `${-CROP.x * k}px ${-CROP.y * k}px`,
  } as const

  return (
    <button
      ref={root}
      type="button"
      className={`logo3d ${className}`}
      style={{ width: size, height: art.height }}
      aria-label="KEOS logo. It tilts toward your cursor. Press to spin."
      onClick={() => setSpin((s) => s + 360)}
    >
      <motion.span className="logo3d__shadow" style={{ x: sx }} aria-hidden="true" />
      <motion.span
        className="logo3d__tilt"
        style={{ rotateX: reduce ? 0 : rotX, rotateY: reduce ? 0 : rotY }}
        animate={{ rotateZ: reduce ? 0 : spin * 0, scale: 1 }}
        whileTap={reduce ? undefined : { scale: 0.95 }}
        transition={{ type: 'spring', visualDuration: 0.4, bounce: 0.2 }}
      >
        <motion.span
          className="logo3d__flip"
          animate={{ rotateY: reduce ? 0 : spin }}
          transition={{ type: 'spring', visualDuration: 0.9, bounce: 0.18 }}
        >
          <span className="logo3d__art" style={art} aria-hidden="true" />
          {!reduce && <motion.span className="logo3d__glare" style={{ backgroundImage: glare }} aria-hidden="true" />}
        </motion.span>
      </motion.span>
    </button>
  )
}
