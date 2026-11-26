import React, { useEffect } from 'react'
import { RotateCcw } from 'lucide-react'
import { useCurriculum } from '../context/CurriculumContext'
import { formatPeriodLabel } from '../lib/curriculumEngine'

export const UndoToast: React.FC = () => {
  const { undoState, undoLastAction, clearUndo, modeToastMessage, clearModeToast } = useCurriculum()

  useEffect(() => {
    if (!undoState) return

    const timer = setTimeout(() => {
      clearUndo()
    }, 3000)

    return () => clearTimeout(timer)
  }, [undoState, clearUndo])

  useEffect(() => {
    if (!modeToastMessage) return

    const timer = setTimeout(() => {
      clearModeToast()
    }, 2500)

    return () => clearTimeout(timer)
  }, [modeToastMessage, clearModeToast])

  if (!undoState && !modeToastMessage) return null

  const pillStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '76px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 1000,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    padding: '6px 12px',
    backgroundColor: 'var(--bg-card)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-card)',
    borderRadius: '9999px',
    boxShadow: 'var(--shadow-sm)',
    fontSize: '0.78rem',
    whiteSpace: 'nowrap',
    maxWidth: '90vw',
    animation: 'fadeInUp 0.2s ease-out forwards',
  }

  if (undoState) {
    const message =
      undoState.type === 'status'
        ? 'Estado actualizado'
        : `Movida a ${formatPeriodLabel(undoState.targetPeriod)}`

    return (
      <div role="status" aria-live="polite" style={pillStyle}>
        <span>{message}</span>
        <button
          type="button"
          onClick={() => {
            undoLastAction()
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 4px',
            background: 'none',
            color: 'var(--color-terracotta)',
            border: 'none',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          aria-label="Deshacer último cambio"
        >
          <RotateCcw size={12} />
          Deshacer
        </button>
      </div>
    )
  }

  return (
    <div role="status" aria-live="polite" style={pillStyle}>
      <span>{modeToastMessage}</span>
    </div>
  )
}
