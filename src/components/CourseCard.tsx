import React from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Check, Lock, Zap, Swords, AlertCircle, Edit3, ArrowLeft, ArrowRight } from 'lucide-react'
import type { Course } from '../types/curriculum'
import { useCurriculum } from '../context/CurriculumContext'
import {
  getMinPassingGrade,
  isGradePassing,
  isIntersemestralPeriod,
  getDisplayColumnPeriod
} from '../lib/curriculumEngine'

interface CourseCardProps {
  course: Course
  isOrganizeMode?: boolean
  isCompactView?: boolean
  effectivePeriod?: number
  hasPeriodConflict?: boolean
  isDragging?: boolean
  isOverlay?: boolean
}

export const CourseCard: React.FC<CourseCardProps> = ({
  course,
  isOrganizeMode = false,
  isCompactView = false,
  effectivePeriod,
  hasPeriodConflict = false,
  isDragging = false,
  isOverlay = false
}) => {
  const {
    computedStateMap,
    customNamesMap,
    gradesMap,
    toggleCourseStatus,
    setInspectedCourseCode,
    focusedCourseCode,
    setFocusedCourseCode,
    showCourseChainInMalla,
    setOrganizeMode,
    showModeToast,
    ancestorPrereqCodes,
    descendantUnlockCodes
  } = useCurriculum()

  const longPressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressOriginRef = React.useRef<{ x: number; y: number } | null>(null)
  const longPressTriggeredRef = React.useRef<boolean>(false)

  const clearLongPressTimer = React.useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    longPressOriginRef.current = null
  }, [])

  React.useEffect(() => clearLongPressTimer, [clearLongPressTimer])

  const state = computedStateMap.get(course.code) || 'locked'
  const customName = customNamesMap.get(course.code)
  const displayName = customName || course.name

  // Chain Glow Directional Focus Status
  const isFocusedSelf = focusedCourseCode === course.code
  const isAncestorPrereq = ancestorPrereqCodes.has(course.code)
  const isDescendantUnlock = descendantUnlockCodes.has(course.code)

  const isIntersemestral = effectivePeriod !== undefined && isIntersemestralPeriod(effectivePeriod)
  const displayColumnPeriod =
    effectivePeriod !== undefined ? getDisplayColumnPeriod(effectivePeriod) : course.period
  const isMovedFromOfficial =
    effectivePeriod !== undefined && (displayColumnPeriod !== course.period || isIntersemestral)

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isOverlay || isDragging || isOrganizeMode) return
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return
    if ((e.target as HTMLElement).closest('button')) return

    clearLongPressTimer()
    longPressTriggeredRef.current = false
    longPressOriginRef.current = { x: e.clientX, y: e.clientY }

    const wasAlreadyRouteMode = focusedCourseCode !== null

    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null
      longPressOriginRef.current = null
      longPressTriggeredRef.current = true

      if (wasAlreadyRouteMode) {
        if ('vibrate' in navigator) {
          try {
            navigator.vibrate([15, 30, 15])
          } catch {
            // ignore
          }
        }
        setOrganizeMode(true)
        showModeToast('Modo organizar · Arrastra cualquier materia')
      } else {
        if ('vibrate' in navigator) {
          try {
            navigator.vibrate(20)
          } catch {
            // ignore
          }
        }
        showCourseChainInMalla(course.code)
        showModeToast('Modo ruta · Toca otra materia o mantén para organizar')
      }
    }, 420)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!longPressTimerRef.current || !longPressOriginRef.current) return
    const dist = Math.hypot(
      e.clientX - longPressOriginRef.current.x,
      e.clientY - longPressOriginRef.current.y
    )
    if (dist > 8) {
      clearLongPressTimer()
    }
  }

  // Only activate hover Chain Glow for real mouse pointers (prevents mobile double-tap hover trap)
  const handlePointerEnter = (e: React.PointerEvent) => {
    if (isOverlay || e.pointerType !== 'mouse') return
    setFocusedCourseCode(course.code)
  }

  const handlePointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      clearLongPressTimer()
      return
    }
    if (isOverlay || e.pointerType !== 'mouse') return
    if (focusedCourseCode === course.code) {
      setFocusedCourseCode(null)
    }
  }

  const handleCardClick = (e: React.MouseEvent) => {
    if (isOverlay) return
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false
      e.preventDefault()
      e.stopPropagation()
      return
    }
    e.stopPropagation()
    if (isOrganizeMode) return
    const canHover = typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches
    if (!canHover && focusedCourseCode !== null) {
      setFocusedCourseCode(course.code)
      return
    }
    if (canHover) {
      setFocusedCourseCode(course.code)
    }
    setInspectedCourseCode(course.code)
  }

  const handleToggleClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (state === 'locked') return

    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(15)
      } catch {
        // ignore
      }
    }
    await toggleCourseStatus(course.code)
  }

  const grade = gradesMap.get(course.code)
  const minGrade = getMinPassingGrade(course)
  const isPassing = grade !== undefined ? isGradePassing(course, grade) : true

  // Base Visual Tokens per State
  let bg = 'var(--node-unlocked-bg)'
  let borderColor = 'var(--node-unlocked-border)'
  let shadow = 'var(--shadow-sm)'
  let opacity = 1

  if (state === 'locked') {
    bg = 'var(--node-locked-bg)'
    borderColor = 'var(--node-locked-border)'
    opacity = 0.75
  } else if (state === 'in_progress') {
    bg = 'var(--node-progress-bg)'
    borderColor = 'var(--node-progress-border)'
    shadow = 'var(--shadow-md)'
  } else if (state === 'completed') {
    bg = 'var(--node-completed-bg)'
    borderColor = 'var(--node-completed-border)'
    shadow = 'var(--shadow-terracotta)'
  } else if (state === 'failed') {
    bg = 'var(--node-failed-bg)'
    borderColor = 'var(--node-failed-border)'
  }

  if (isIntersemestral && state !== 'locked' && state !== 'failed') {
    bg = 'var(--node-inter-bg)'
    borderColor = 'var(--node-inter-border)'
  }

  if (hasPeriodConflict && !isFocusedSelf && !isAncestorPrereq && !isDescendantUnlock) {
    bg = 'rgba(220, 38, 38, 0.08)'
    borderColor = '#DC2626'
    shadow = '0 0 0 2px rgba(220, 38, 38, 0.25)'
  }

  // GPU-Accelerated Directional Chain Glow Overrides
  const isAnyFocused = focusedCourseCode !== null && !isOverlay
  let cardFilter: string | undefined

  if (isFocusedSelf) {
    borderColor = 'var(--color-terracotta)'
    shadow = '0 0 0 3px rgba(115, 72, 47, 0.35), 0 10px 22px rgba(35, 43, 56, 0.14)'
    opacity = 1
  } else if (isAncestorPrereq) {
    borderColor = '#D97706'
    shadow = 'var(--shadow-glow-req)'
    opacity = 1
  } else if (isDescendantUnlock) {
    borderColor = '#0D9488'
    shadow = 'var(--shadow-glow-next)'
    opacity = 1
  } else if (isAnyFocused) {
    opacity = 0.45
    cardFilter = 'saturate(0.75)'
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (focusedCourseCode !== course.code) {
        setFocusedCourseCode(course.code)
      }
      setInspectedCourseCode(course.code)
    }
  }

  return (
    <motion.div
      tabIndex={0}
      role="button"
      aria-label={`Materia ${displayName}, ${course.credits} créditos, Código ${course.code}, Estado: ${state}`}
      onKeyDown={handleKeyDown}
      whileHover={isOverlay || isDragging ? undefined : { scale: state === 'locked' ? 1 : 1.02 }}
      whileTap={isOverlay || isDragging ? undefined : { scale: 0.98 }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearLongPressTimer}
      onPointerCancel={clearLongPressTimer}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onContextMenu={e => {
        if (longPressTriggeredRef.current || longPressTimerRef.current) {
          e.preventDefault()
        }
      }}
      onClick={handleCardClick}
      className="transition-all"

      style={{
        padding: isCompactView ? '6px 8px' : '16px',
        borderRadius: isCompactView ? 'var(--radius-sm)' : 'var(--radius-md)',
        backgroundColor: bg,
        border: isDragging ? '2px dashed var(--color-steel)' : `2px solid ${borderColor}`,
        boxShadow: isOverlay ? '0 16px 32px rgba(35, 43, 56, 0.25)' : shadow,
        opacity: isDragging ? 0.35 : opacity,
        filter: isDragging ? undefined : cardFilter,
        cursor: isOverlay ? 'grabbing' : isOrganizeMode ? 'grab' : 'pointer',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: isCompactView ? '3px' : '10px',
        minHeight: isCompactView ? '52px' : '145px',
        transform: isOverlay ? 'scale(1.03)' : undefined,
        willChange: 'transform, box-shadow, border-color',
        userSelect: 'none',
        WebkitTouchCallout: 'none'
      }}
    >
      {/* Same-period Prerequisite Conflict Badge */}
      {hasPeriodConflict && !isAncestorPrereq && !isDescendantUnlock && (
        <div
          style={{
            position: 'absolute',
            top: '-9px',
            left: '10px',
            zIndex: 5,
            backgroundColor: '#DC2626',
            color: '#FFFFFF',
            fontSize: '9px',
            fontWeight: 700,
            padding: '1px 6px',
            borderRadius: '9999px',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            boxShadow: 'var(--shadow-sm)'
          }}
          title="Esta materia comparte el mismo semestre con un requisito o materia que desbloquea"
        >
          Conflicto req.
        </div>
      )}

      {/* Chain Glow Directional Badges */}
      {isAncestorPrereq && (
        <div
          style={{
            position: 'absolute',
            top: '-10px',
            left: '12px',
            zIndex: 5,
            backgroundColor: '#D97706',
            color: '#FFFFFF',
            fontSize: '10px',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 'var(--radius-full)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <ArrowLeft size={10} /> Requisito Previo
        </div>
      )}

      {isDescendantUnlock && (
        <div
          style={{
            position: 'absolute',
            top: '-10px',
            right: '12px',
            zIndex: 5,
            backgroundColor: '#0D9488',
            color: '#FFFFFF',
            fontSize: '10px',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 'var(--radius-full)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          Desbloquea <ArrowRight size={10} />
        </div>
      )}

      {/* Top Header: Category, Drag Handle & Credits */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {!isCompactView && isIntersemestral && (
            <span
              style={{
                fontSize: '9px',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(124, 58, 237, 0.14)',
                color: '#7C3AED',
                border: '1px solid rgba(124, 58, 237, 0.35)'
              }}
              title={`Cursada en intersemestral posterior al ${displayColumnPeriod}º semestre`}
            >
              Intersemestral
            </span>
          )}
          {!isCompactView && isMovedFromOfficial && (
            <span
              style={{
                fontSize: '9px',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(109, 134, 166, 0.16)',
                color: 'var(--color-steel)',
                border: '1px solid rgba(109, 134, 166, 0.35)'
              }}
              title={`Ubicación oficial en el pénsum: ${course.period}º semestre`}
            >
              Oficial: {course.period}º
            </span>
          )}
          {!isCompactView && minGrade === 3.5 && (
            <span
              style={{
                fontSize: '9px',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(220, 38, 38, 0.10)',
                color: '#DC2626',
                border: '1px solid rgba(220, 38, 38, 0.25)'
              }}
              title="Exigencia de aprobación especial según Art. 42 REA (Nota mínima 3.5)"
            >
              Mín: 3.5
            </span>
          )}

          {!isCompactView && (course.is_diagnostic ? (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: '#FEF3C7',
                color: '#D97706',
                border: '1px solid #FCD34D'
              }}
            >
              Diagnóstico
            </span>
          ) : course.category === 'general_education' ? (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--bg-card-muted)',
                color: 'var(--color-steel)'
              }}
            >
              Formación General
            </span>
          ) : course.category === 'specialization' ? (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: '#FDF0EC',
                color: 'var(--color-terracotta)'
              }}
            >
              Énfasis (8 cr)
            </span>
          ) : course.category === 'elective' ? (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: '#EFF6FF',
                color: '#2563EB'
              }}
            >
              Electiva
            </span>
          ) : null)}

          {!isCompactView && course.learning_field && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--bg-card-muted)',
                color: 'var(--text-secondary)'
              }}
            >
              {course.learning_field}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: state === 'completed' ? 'var(--color-terracotta)' : 'var(--text-secondary)',
              whiteSpace: 'nowrap'
            }}
          >
            {course.credits > 0 ? `${course.credits} cr` : '0 cr'}
          </span>
        </div>
      </div>

      {/* Course Title & Code */}
      <div>
        <h3
          style={{
            fontSize: isCompactView ? '11px' : '14px',
            fontWeight: 700,
            lineHeight: isCompactView ? 1.15 : 1.3,
            color: state === 'locked' ? 'var(--text-secondary)' : 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          {displayName}
          {customName && <Edit3 size={12} color="var(--color-steel)" />}
        </h3>
        {!isCompactView && (
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {course.code}
          </p>
        )}
      </div>

      {/* Footer State & Action Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: isCompactView ? '1px' : '4px' }}>
        {state === 'completed' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: !isPassing ? '#DC2626' : 'var(--color-terracotta)', flexWrap: 'wrap' }}>
            <CheckCircle2 size={14} color={!isPassing ? '#DC2626' : 'var(--color-terracotta)'} />
            <span>{!isPassing ? 'Insuficiente' : 'Aprobada'}</span>
            {grade !== undefined ? (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: isPassing ? 'var(--color-terracotta)' : '#DC2626',
                  color: '#FFFFFF'
                }}
              >
                {grade.toFixed(1)}
              </span>
            ) : !isCompactView && !course.is_diagnostic ? (
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 600,
                  padding: '1px 5px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'rgba(217, 119, 6, 0.12)',
                  color: '#D97706',
                  border: '1px dashed rgba(217, 119, 6, 0.4)'
                }}
              >
                Sin nota
              </span>
            ) : null}
          </div>
        ) : state === 'in_progress' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: 'var(--color-slate-mid)' }}>
            <Swords size={14} color="var(--color-slate-mid)" />
            <span>En curso</span>
            {grade !== undefined && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: isPassing ? 'var(--color-slate-mid)' : '#DC2626',
                  color: '#FFFFFF'
                }}
              >
                {grade.toFixed(1)}
              </span>
            )}
          </div>
        ) : state === 'unlocked' ? (
          isCompactView ? (
            <span />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: 'var(--color-steel)' }}>
              <Zap size={14} color="var(--color-steel)" />
              <span>Disponible</span>
            </div>
          )
        ) : state === 'failed' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#DC2626' }}>
            <AlertCircle size={14} color="#DC2626" />
            <span>Por nivelar</span>
            {grade !== undefined && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF'
                }}
              >
                {grade.toFixed(1)}
              </span>
            )}
          </div>
        ) : (
          isCompactView ? (
            <Lock size={12} color="var(--color-slate-light)" />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-secondary)' }}>
              <Lock size={13} color="var(--color-slate-light)" />
              <span>Bloqueada</span>
            </div>
          )
        )}

        {/* Action Button */}
        {state !== 'locked' && (isOrganizeMode || focusedCourseCode !== null) && (
          isCompactView ? (
            <button
              type="button"
              onPointerDown={e => e.stopPropagation()}
              onTouchStart={e => e.stopPropagation()}
              onClick={handleToggleClick}
              title={state === 'completed' ? 'Desmarcar materia' : 'Marcar como aprobada'}
              aria-label={state === 'completed' ? `Desmarcar ${displayName}` : `Aprobar ${displayName}`}
              style={{
                width: '30px',
                height: '30px',
                borderRadius: 'var(--radius-full)',
                border: state === 'completed' ? 'none' : '1px solid var(--border-card)',
                backgroundColor: state === 'completed' ? 'var(--color-terracotta)' : 'var(--bg-main)',
                color: state === 'completed' ? '#FFFFFF' : 'var(--color-steel)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                flexShrink: 0,
                touchAction: 'manipulation'
              }}
            >
              <Check size={14} strokeWidth={2.5} />
            </button>
          ) : (
            <button
              type="button"
              onPointerDown={e => e.stopPropagation()}
              onTouchStart={e => e.stopPropagation()}
              onClick={handleToggleClick}
              title={state === 'completed' ? 'Marcar como pendiente' : 'Marcar como aprobada'}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: state === 'completed' ? 'var(--bg-card-muted)' : 'var(--color-terracotta)',
                color: state === 'completed' ? 'var(--text-primary)' : '#FFFFFF',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                touchAction: 'manipulation'
              }}
            >
              {state === 'completed' ? 'Desmarcar' : 'Aprobar'}
            </button>
          )
        )}
      </div>
    </motion.div>
  )
}
