import { useRef, useCallback } from 'react'

export function useAlarmSound() {
  const ctxRef = useRef(null)

  const play = useCallback((severity = 'warning') => {
    try {
      if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      const ctx = ctxRef.current

      // critical = 3 fast beeps, warning = 2 beeps, info = 1 beep
      const beeps = severity === 'critical' ? 3 : severity === 'warning' ? 2 : 1
      const freq  = severity === 'critical' ? 880 : severity === 'warning' ? 660 : 440

      for (let i = 0; i < beeps; i++) {
        const osc  = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.type      = 'square'
        osc.frequency.value = freq

        const start = ctx.currentTime + i * 0.35
        gain.gain.setValueAtTime(0.3, start)
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25)

        osc.start(start)
        osc.stop(start + 0.25)
      }
    } catch {
      // AudioContext blocked or unavailable
    }
  }, [])

  return play
}
