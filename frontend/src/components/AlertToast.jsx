import { useEffect, useState } from 'react'

const SEV = {
  critical: { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-600'    },
  warning:  { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-600'  },
  info:     { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-600'   },
}

export default function AlertToast({ alerts, onDismiss }) {
  return (
    <div className="fixed bottom-6 right-6 flex flex-col gap-2.5 z-[9999] max-w-sm w-full pointer-events-none">
      {alerts.map(a => <Toast key={a.id} alert={a} onDismiss={onDismiss} />)}
    </div>
  )
}

function Toast({ alert: a, onDismiss }) {
  const [visible, setVisible] = useState(true)
  const cls = SEV[a.severity] ?? SEV.info

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); setTimeout(() => onDismiss(a.id), 300) }, 6000)
    return () => clearTimeout(t)
  }, [a.id, onDismiss])

  return (
    <div className={`
      pointer-events-auto border rounded-xl p-3.5 shadow-lg transition-all duration-300
      ${cls.bg} ${cls.border}
      ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'}
    `}>
      <div className="flex items-start gap-2.5">
        <span className="text-xl">{a.severity === 'critical' ? '🚨' : a.severity === 'warning' ? '⚠️' : 'ℹ️'}</span>
        <div className="flex-1">
          <div className={`font-bold text-sm ${cls.text}`}>{a.severity.toUpperCase()} — Zone Breach</div>
          <div className="text-slate-600 text-xs mt-0.5">{a.message}</div>
        </div>
        <button
          onClick={() => { setVisible(false); setTimeout(() => onDismiss(a.id), 300) }}
          className="text-slate-400 hover:text-slate-600 text-sm leading-none cursor-pointer"
        >✕</button>
      </div>
    </div>
  )
}
