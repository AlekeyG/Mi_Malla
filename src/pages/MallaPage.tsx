import React, { useMemo, useState, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  pointerWithin,
  closestCorners,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  CheckCheck,
  FlaskConical,
  EyeOff,
  ArrowLeftRight,
  Plus,
  AlertTriangle,
  AlertCircle,
  X,
  LayoutGrid,
  Info,
  GitBranch
} from 'lucide-react'
import { useCurriculum } from '../context/CurriculumContext'
import { CourseCard } from '../components/CourseCard'
import {
  getCourse,
  getEffectivePeriod,
  getDisplayColumnPeriod,
  isIntersemestralPeriod,
  formatPeriodLabel,
  evaluateCourseMove,
  getSamePeriodPrereqConflicts,
  MAX_CREDITS_PER_SEMESTER,
  MAX_INTERSEMESTRAL_CREDITS,
  MAX_PLANNED_PERIOD
} from '../lib/curriculumEngine'
import type { Course, MoveEvaluationResult } from '../types/curriculum'

const customCollisionDetection: CollisionDetection = args => {
  const pointerCollisions = pointerWithin(args)
  if (pointerCollisions.length > 0) {
    const priorityCollision = pointerCollisions.find(
      c => String(c.id).startsWith('pill-') || String(c.id).startsWith('inter-')
    )
    return priorityCollision ? [priorityCollision] : pointerCollisions
  }
  return closestCorners(args)
}

interface DraggableCourseWrapperProps {
  course: Course
  isOrganizeMode: boolean
  isCompactView: boolean
  effectivePeriod: number
  hasPeriodConflict?: boolean
}

const DraggableCourseWrapper: React.FC<DraggableCourseWrapperProps> = ({
  course,
  isOrganizeMode,
  isCompactView,
  effectivePeriod,
  hasPeriodConflict = false
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: course.code,
    disabled: !isOrganizeMode
  })

  return (
    <div
      ref={setNodeRef}
      {...(isOrganizeMode ? { ...attributes, ...listeners } : {})}
    >
      <CourseCard
        course={course}
        isOrganizeMode={isOrganizeMode}
        isCompactView={isCompactView}
        effectivePeriod={effectivePeriod}
        hasPeriodConflict={hasPeriodConflict}
        isDragging={isDragging}
      />
    </div>
  )
}

interface DroppablePeriodPillProps {
  periodNum: number
  isSelected: boolean
  isOrganizeMode: boolean
  isDraggingActive: boolean
  evaluation?: MoveEvaluationResult
  isExtraTrigger?: boolean
  onClick: () => void
}

const DroppablePeriodPill: React.FC<DroppablePeriodPillProps> = ({
  periodNum,
  isSelected,
  isOrganizeMode,
  isDraggingActive,
  evaluation,
  isExtraTrigger = false,
  onClick
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `pill-${periodNum}`,
    data: { period: periodNum },
    disabled: !isOrganizeMode
  })

  let border = isSelected ? '2px solid var(--color-terracotta)' : '1px solid var(--border-card)'
  let bg = isSelected ? 'var(--color-terracotta)' : 'var(--bg-card)'
  let color = isSelected ? '#FFFFFF' : 'var(--text-primary)'
  let opacity = 1
  let boxShadow = isSelected ? 'var(--shadow-terracotta)' : 'none'

  if (isExtraTrigger && !isDraggingActive) {
    border = '1px dashed var(--color-steel)'
    bg = 'var(--bg-card-muted)'
    color = 'var(--color-steel)'
  }

  if (isDraggingActive && evaluation) {
    if (evaluation.fromPeriod === periodNum) {
      border = '2px solid var(--color-steel)'
      bg = 'var(--bg-card-muted)'
      color = 'var(--color-steel)'
    } else if (!evaluation.allowed) {
      border = '1px dashed rgba(220, 38, 38, 0.45)'
      bg = '#FEF2F2'
      color = '#B91C1C'
      opacity = 0.65
    } else if (evaluation.severity === 'cascade' || evaluation.severity === 'warning') {
      border = isOver ? '2px solid #D97706' : '1px solid #F59E0B'
      bg = isOver ? '#FDE68A' : '#FEF3C7'
      color = '#92400E'
    } else {
      border = isOver ? '2px solid #16A34A' : '1px solid #22C55E'
      bg = isOver ? '#BBF7D0' : '#ECFDF5'
      color = '#15803D'
    }

    if (isOver) {
      boxShadow = '0 0 0 3px rgba(115, 72, 47, 0.25)'
    }
  }

  return (
    <button
      ref={setNodeRef}
      id={`period-pill-${periodNum}`}
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: 'var(--radius-full)',
        border,
        backgroundColor: bg,
        color,
        opacity,
        fontSize: '12px',
        fontWeight: 700,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'all 0.15s ease',
        transform: isOver && isDraggingActive ? 'scale(1.1)' : 'scale(1)',
        boxShadow,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        flexShrink: 0
      }}
    >
      {isExtraTrigger ? (
        <>
          <Plus size={12} /> {periodNum}º
        </>
      ) : (
        `${periodNum}º`
      )}
    </button>
  )
}

interface DroppablePeriodColumnProps {
  periodNum: number
  colWidth: number
  isCompact: boolean
  isOrganizeMode: boolean
  isDraggingActive: boolean
  evaluation?: MoveEvaluationResult
  children: React.ReactNode
}

const DroppablePeriodColumn: React.FC<DroppablePeriodColumnProps> = ({
  periodNum,
  colWidth,
  isCompact,
  isOrganizeMode,
  isDraggingActive,
  evaluation,
  children
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `col-${periodNum}`,
    data: { period: periodNum },
    disabled: !isOrganizeMode
  })

  let border = '1px solid var(--border-card)'
  let bg = 'var(--bg-card)'

  if (isDraggingActive && evaluation && evaluation.fromPeriod !== periodNum) {
    if (!evaluation.allowed) {
      border = isOver ? '2px dashed #DC2626' : '1px dashed rgba(220, 38, 38, 0.35)'
      bg = isOver ? 'rgba(254, 242, 242, 0.7)' : 'var(--bg-card)'
    } else if (evaluation.severity === 'cascade' || evaluation.severity === 'warning') {
      border = isOver ? '2px solid #D97706' : '1px solid rgba(245, 158, 11, 0.6)'
      bg = isOver ? 'rgba(254, 243, 199, 0.35)' : 'var(--bg-card)'
    } else {
      border = isOver ? '2px solid #16A34A' : '1px solid rgba(34, 197, 94, 0.55)'
      bg = isOver ? 'rgba(236, 253, 245, 0.45)' : 'var(--bg-card)'
    }
  }

  return (
    <div
      ref={setNodeRef}
      id={`period-col-${periodNum}`}
      style={{
        minWidth: `${colWidth}px`,
        maxWidth: `${Math.round(colWidth * 1.1)}px`,
        flex: `0 0 ${colWidth}px`,
        scrollSnapAlign: 'start',
        backgroundColor: bg,
        borderRadius: 'var(--radius-lg)',
        padding: isCompact ? '12px 14px' : '20px',
        border,
        display: 'flex',
        flexDirection: 'column',
        gap: isCompact ? '10px' : '16px',
        transition: 'min-width 0.1s ease, flex 0.1s ease, padding 0.1s ease, border-color 0.15s ease, background-color 0.15s ease'
      }}
    >
      {isOver && evaluation && evaluation.fromPeriod !== periodNum && (
        <div
          style={{
            padding: '7px 10px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '11px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: !evaluation.allowed
              ? '#FEE2E2'
              : evaluation.severity === 'valid'
                ? '#DCFCE7'
                : '#FEF3C7',
            color: !evaluation.allowed
              ? '#B91C1C'
              : evaluation.severity === 'valid'
                ? '#15803D'
                : '#92400E',
            border: !evaluation.allowed
              ? '1px solid #FCA5A5'
              : evaluation.severity === 'valid'
                ? '1px solid #86EFAC'
                : '1px solid #FCD34D'
          }}
        >
          {!evaluation.allowed ? (
            <span>✕ {evaluation.reason}</span>
          ) : evaluation.cascadeShifts.length > 0 ? (
            <span>
              ⇄ Desplazará {evaluation.cascadeShifts.length} materia{evaluation.cascadeShifts.length > 1 ? 's' : ''} ({evaluation.targetCreditsAfter}/{MAX_CREDITS_PER_SEMESTER} cr)
            </span>
          ) : evaluation.warnings.length > 0 ? (
            <span>⚠ Con aviso académico ({evaluation.targetCreditsAfter}/{MAX_CREDITS_PER_SEMESTER} cr)</span>
          ) : (
            <span>✓ Soltar aquí ({evaluation.targetCreditsAfter}/{MAX_CREDITS_PER_SEMESTER} cr)</span>
          )}
        </div>
      )}
      {children}
    </div>
  )
}

interface DroppableIntersemestralZoneProps {
  basePeriod: number
  interCourses: Course[]
  interCredits: number
  isCompact: boolean
  isCompactView: boolean
  isOrganizeMode: boolean
  isDraggingActive: boolean
  evaluation?: MoveEvaluationResult
  plannedPeriodMap: Map<string, number>
  samePeriodConflictCodes: Set<string>
}

const DroppableIntersemestralZone: React.FC<DroppableIntersemestralZoneProps> = ({
  basePeriod,
  interCourses,
  interCredits,
  isCompact,
  isCompactView,
  isOrganizeMode,
  isDraggingActive,
  evaluation,
  plannedPeriodMap,
  samePeriodConflictCodes
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `inter-${basePeriod}`,
    data: { period: basePeriod + 0.5 },
    disabled: !isOrganizeMode
  })

  if (!isOrganizeMode && interCourses.length === 0) return null

  const isOverLimit = interCredits > MAX_INTERSEMESTRAL_CREDITS
  let border = '1px dashed rgba(124, 58, 237, 0.35)'
  let bg = 'rgba(124, 58, 237, 0.05)'

  if (isDraggingActive && evaluation && evaluation.fromPeriod !== basePeriod + 0.5) {
    if (!evaluation.allowed) {
      border = isOver ? '2px dashed #DC2626' : '1px dashed rgba(220, 38, 38, 0.35)'
      bg = isOver ? 'rgba(254, 242, 242, 0.8)' : 'rgba(124, 58, 237, 0.04)'
    } else if (evaluation.severity === 'cascade' || evaluation.severity === 'warning') {
      border = isOver ? '2px solid #D97706' : '1px dashed #F59E0B'
      bg = isOver ? 'rgba(254, 243, 199, 0.45)' : 'rgba(124, 58, 237, 0.05)'
    } else {
      border = isOver ? '2px solid #7C3AED' : '1px dashed rgba(124, 58, 237, 0.65)'
      bg = isOver ? 'rgba(237, 233, 254, 0.8)' : 'rgba(124, 58, 237, 0.06)'
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        marginTop: '4px',
        padding: isCompact ? '8px' : '12px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: bg,
        border,
        display: 'flex',
        flexDirection: 'column',
        gap: isCompact ? '8px' : '10px',
        transition: 'all 0.15s ease'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '11px', fontWeight: 800, color: '#7C3AED' }}>
          Intersemestral (post {basePeriod}º)
        </span>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: isOverLimit ? '#DC2626' : '#7C3AED'
          }}
        >
          {interCredits}/{MAX_INTERSEMESTRAL_CREDITS} cr
        </span>
      </div>

      {isOver && evaluation && evaluation.fromPeriod !== basePeriod + 0.5 && (
        <div
          style={{
            padding: '5px 8px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '10px',
            fontWeight: 700,
            backgroundColor: !evaluation.allowed
              ? '#FEE2E2'
              : evaluation.severity === 'valid'
                ? '#EDE9FE'
                : '#FEF3C7',
            color: !evaluation.allowed
              ? '#B91C1C'
              : evaluation.severity === 'valid'
                ? '#6D28D9'
                : '#92400E'
          }}
        >
          {!evaluation.allowed
            ? `✕ ${evaluation.reason}`
            : `✓ Soltar en Intersemestral (${evaluation.targetCreditsAfter}/${MAX_INTERSEMESTRAL_CREDITS} cr)`}
        </div>
      )}

      {interCourses.length > 0 ? (
        interCourses.map(course => (
          <DraggableCourseWrapper
            key={course.code}
            course={course}
            isOrganizeMode={isOrganizeMode}
            isCompactView={isCompactView}
            effectivePeriod={getEffectivePeriod(course, plannedPeriodMap)}
            hasPeriodConflict={samePeriodConflictCodes.has(course.code)}
          />
        ))
      ) : (
        <div style={{ textAlign: 'center', fontSize: '11px', color: '#7C3AED', opacity: 0.85, padding: '6px 4px' }}>
          Suelta aquí para cursar en intersemestral (no suma a los 18 cr)
        </div>
      )}
    </div>
  )
}

export const MallaPage: React.FC = () => {
  const {
    courses,
    computedStateMap,
    plannedPeriodMap,
    visiblePeriods,
    selectedPeriod,
    setSelectedPeriod,
    completeSemester,
    uncompleteSemester,
    isSimulationMode,
    toggleSimulationMode,
    isOrganizeMode,
    toggleOrganizeMode,
    isRouteMode,
    toggleRouteMode,
    addExtraPeriod,
    moveCourseToPeriod,
    gpaMetrics,
    hideDiagnosticsInMalla
  } = useCurriculum()

  // Compact panoramic view (persisted in localStorage, defaults to true on desktop >= 1024px)
  const [isCompactView, setIsCompactView] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem('mi_malla_compact_view')
      if (saved === 'true') return true
      if (saved === 'false') return false
    } catch {
      // ignore
    }
    return typeof window !== 'undefined' && window.innerWidth >= 1024
  })

  useEffect(() => {
    try {
      window.localStorage.setItem('mi_malla_compact_view', String(isCompactView))
    } catch {
      // ignore
    }
  }, [isCompactView])

  // Zoom Level State (range 0.6x to 1.25x)
  const [zoomScale, setZoomScale] = React.useState<number>(1.0)
  const zoomScaleRef = React.useRef<number>(1.0)
  React.useEffect(() => {
    zoomScaleRef.current = zoomScale
  }, [zoomScale])

  // Drag & Drop State
  const [activeDragCode, setActiveDragCode] = useState<string | null>(null)
  const [pendingMoveEval, setPendingMoveEval] = useState<MoveEvaluationResult | null>(null)
  const [pendingCompletePeriod, setPendingCompletePeriod] = useState<number | null>(null)
  const [pendingUncompletePeriod, setPendingUncompletePeriod] = useState<number | null>(null)
  const [blockedBanner, setBlockedBanner] = useState<string | null>(null)
  const [openInfoPeriod, setOpenInfoPeriod] = useState<number | null>(null)

  useEffect(() => {
    if (!blockedBanner) return
    const timer = setTimeout(() => setBlockedBanner(null), 5000)
    return () => clearTimeout(timer)
  }, [blockedBanner])

  const activeSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  )
  const emptySensors = useSensors()

  const containerRef = React.useRef<HTMLDivElement>(null)
  const touchStateRef = React.useRef<{
    initialDist: number
    initialZoom: number
    lastDoubleTapTime: number
  }>({
    initialDist: 0,
    initialZoom: 1.0,
    lastDoubleTapTime: 0
  })

  const lastVisiblePeriod = visiblePeriods[visiblePeriods.length - 1] ?? 9
  const nextExtraPeriod = lastVisiblePeriod < MAX_PLANNED_PERIOD ? lastVisiblePeriod + 1 : null

  const samePeriodConflictCodes = useMemo(
    () => getSamePeriodPrereqConflicts(plannedPeriodMap),
    [plannedPeriodMap]
  )

  // Pre-evaluate every period (regular & intersemestral) as a drop target while dragging
  const evaluationsByPeriod = useMemo(() => {
    const map = new Map<number, MoveEvaluationResult>()
    if (!activeDragCode) return map
    for (const p of visiblePeriods) {
      map.set(p, evaluateCourseMove(activeDragCode, p, plannedPeriodMap))
      map.set(p + 0.5, evaluateCourseMove(activeDragCode, p + 0.5, plannedPeriodMap))
    }
    if (nextExtraPeriod !== null) {
      map.set(nextExtraPeriod, evaluateCourseMove(activeDragCode, nextExtraPeriod, plannedPeriodMap))
    }
    return map
  }, [activeDragCode, visiblePeriods, nextExtraPeriod, plannedPeriodMap])

  const activeDragCourse = activeDragCode ? getCourse(activeDragCode) : undefined

  const getCoursesForColumn = (p: number) => {
    const allInCol = courses
      .filter(c => getDisplayColumnPeriod(getEffectivePeriod(c, plannedPeriodMap)) === p)
      .filter(c => !hideDiagnosticsInMalla || !c.is_diagnostic)
      .sort((a, b) => {
        if (a.is_diagnostic === b.is_diagnostic) return 0
        return a.is_diagnostic ? 1 : -1
      })

    const regularCourses = allInCol.filter(
      c => !isIntersemestralPeriod(getEffectivePeriod(c, plannedPeriodMap))
    )
    const interCourses = allInCol.filter(
      c => isIntersemestralPeriod(getEffectivePeriod(c, plannedPeriodMap))
    )
    return { regularCourses, interCourses }
  }

  const isPillClickRef = React.useRef(false)
  const pillsContainerRef = React.useRef<HTMLDivElement>(null)

  // Auto-scroll active pill horizontally inside pills container ONLY (without jumping the window vertically)
  React.useEffect(() => {
    const pillsContainer = pillsContainerRef.current
    const activePill = document.getElementById(`period-pill-${selectedPeriod}`)
    if (pillsContainer && activePill) {
      const containerRect = pillsContainer.getBoundingClientRect()
      const pillRect = activePill.getBoundingClientRect()
      const targetLeft =
        pillsContainer.scrollLeft +
        (pillRect.left - containerRect.left) -
        containerRect.width / 2 +
        pillRect.width / 2
      pillsContainer.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' })
    }
  }, [selectedPeriod])

  const handlePeriodPillClick = (periodNum: number) => {
    setSelectedPeriod(periodNum)
    isPillClickRef.current = true
    const container = containerRef.current
    const el = document.getElementById(`period-col-${periodNum}`)
    if (container && el) {
      const containerRect = container.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      const targetLeft = container.scrollLeft + (elRect.left - containerRect.left)
      container.scrollTo({ left: targetLeft, behavior: 'smooth' })
      setTimeout(() => {
        isPillClickRef.current = false
      }, 500)
    }
  }

  const scrollTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleScroll = () => {
    if (isPillClickRef.current || activeDragCode) return
    const container = containerRef.current
    if (!container) return

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }

    scrollTimeoutRef.current = setTimeout(() => {
      if (!container) return
      const containerRect = container.getBoundingClientRect()
      let closestPeriod = 1
      let minDistance = Infinity

      for (const p of visiblePeriods) {
        const el = document.getElementById(`period-col-${p}`)
        if (el) {
          const elRect = el.getBoundingClientRect()
          const dist = Math.abs(elRect.left - containerRect.left)
          if (dist < minDistance) {
            minDistance = dist
            closestPeriod = p
          }
        }
      }

      if (closestPeriod !== selectedPeriod) {
        setSelectedPeriod(closestPeriod)
      }
    }, 100)
  }

  // Registrar listeners nativos con passive: false para que e.preventDefault() funcione correctamente
  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheelNative = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault()
        const delta = -e.deltaY * 0.002
        setZoomScale(prev => Math.min(1.25, Math.max(0.6, prev + delta)))
      }
    }

    const handleTouchMoveNative = (e: TouchEvent) => {
      if (e.touches.length === 2 && touchStateRef.current.initialDist > 0) {
        e.preventDefault()
        const t1 = e.touches[0]
        const t2 = e.touches[1]
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
        const factor = dist / touchStateRef.current.initialDist
        const newZoom = Math.min(1.25, Math.max(0.6, touchStateRef.current.initialZoom * factor))
        setZoomScale(newZoom)
      }
    }

    container.addEventListener('wheel', handleWheelNative, { passive: false })
    container.addEventListener('touchmove', handleTouchMoveNative, { passive: false })

    return () => {
      container.removeEventListener('wheel', handleWheelNative)
      container.removeEventListener('touchmove', handleTouchMoveNative)
    }
  }, [])

  // Gesto táctil de 2 dedos (Pinch-to-Zoom & Double-Tap Reset)
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0]
      const t2 = e.touches[1]
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)

      const now = Date.now()
      if (now - touchStateRef.current.lastDoubleTapTime < 300) {
        setZoomScale(1.0)
      }
      touchStateRef.current.lastDoubleTapTime = now

      touchStateRef.current.initialDist = dist
      touchStateRef.current.initialZoom = zoomScaleRef.current
    }
  }

  const handleTouchEnd = () => {
    touchStateRef.current.initialDist = 0
  }

  const triggerHaptic = (pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(pattern)
      } catch {
        // ignore
      }
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragCode(String(event.active.id))
    setBlockedBanner(null)
    triggerHaptic(15)
  }

  const executeMove = async (evaluation: MoveEvaluationResult) => {
    await moveCourseToPeriod(evaluation.courseCode, evaluation.targetPeriod)
    triggerHaptic(15)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const draggedCode = String(event.active.id)
    setActiveDragCode(null)

    const targetPeriod = event.over?.data.current?.period as number | undefined
    if (!targetPeriod) return

    const evaluation = evaluateCourseMove(draggedCode, targetPeriod, plannedPeriodMap)
    if (targetPeriod === evaluation.fromPeriod) return

    if (!evaluation.allowed) {
      setBlockedBanner(evaluation.reason || 'Movimiento bloqueado por regla académica.')
      triggerHaptic([25, 40, 25])
      return
    }

    if (evaluation.cascadeShifts.length > 0 || evaluation.warnings.length > 0) {
      setPendingMoveEval(evaluation)
      return
    }

    await executeMove(evaluation)
  }

  const handleDragCancel = () => {
    setActiveDragCode(null)
  }

  // Ancho dinámico de columna según vista compacta y nivel de Zoom
  const baseColWidth = isCompactView ? 155 : 320
  const colWidth = Math.round(baseColWidth * zoomScale)
  const isCompact = isCompactView || zoomScale < 0.85

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Simulation Banner (only if active) */}
      {isSimulationMode && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#FEF3C7',
            border: '1px solid #F59E0B',
            borderRadius: 'var(--radius-md)',
            padding: '8px 14px',
            fontSize: '12px',
            color: '#92400E',
            fontWeight: 600
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FlaskConical size={16} color="#D97706" />
            <span>Modo Simulación Activo ("What-If") — Los cambios no afectan tus datos reales</span>
          </div>
          <button
            onClick={toggleSimulationMode}
            style={{
              padding: '3px 8px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: '#D97706',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            Salir
          </button>
        </div>
      )}

      {/* Barra de Herramientas de Organización */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={toggleOrganizeMode}
            aria-pressed={isOrganizeMode}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: 'var(--radius-full)',
              border: isOrganizeMode ? '2px solid var(--color-terracotta)' : '1px solid var(--border-card)',
              backgroundColor: isOrganizeMode ? 'var(--color-terracotta)' : 'var(--bg-card)',
              color: isOrganizeMode ? '#FFFFFF' : 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: isOrganizeMode ? 'var(--shadow-terracotta)' : 'var(--shadow-sm)'
            }}
          >
            <ArrowLeftRight size={14} />
            {isOrganizeMode ? 'Listo (Organizando)' : 'Organizar Malla'}
          </button>

          <button
            type="button"
            onClick={toggleRouteMode}
            aria-pressed={isRouteMode}
            title="Fijar rutas de requisitos al hacer clic en materias"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: 'var(--radius-full)',
              border: isRouteMode ? '2px solid var(--color-steel)' : '1px solid var(--border-card)',
              backgroundColor: isRouteMode ? 'var(--color-steel)' : 'var(--bg-card)',
              color: isRouteMode ? '#FFFFFF' : 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <GitBranch size={14} />
            {isRouteMode ? 'Modo Ruta (Activo)' : 'Modo Ruta'}
          </button>

          <button
            onClick={() => setIsCompactView(prev => !prev)}
            aria-pressed={isCompactView}
            title="Alternar entre vista de cuadros compactos y tarjetas detalladas"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: 'var(--radius-full)',
              border: isCompactView ? '2px solid var(--color-steel)' : '1px solid var(--border-card)',
              backgroundColor: isCompactView ? 'var(--bg-card-muted)' : 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <LayoutGrid size={14} color={isCompactView ? 'var(--color-terracotta)' : 'var(--color-steel)'} />
            {isCompactView ? 'Vista Normal' : 'Vista Compacta'}
          </button>
        </div>

        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Tope por semestre: {MAX_CREDITS_PER_SEMESTER} cr
        </span>
      </div>

      {/* Guía contextual en Modo Organizar */}
      {isOrganizeMode && (
        <div
          style={{
            padding: '9px 14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(122, 152, 191, 0.12)',
            border: '1px solid rgba(122, 152, 191, 0.35)',
            fontSize: '12px',
            color: 'var(--text-primary)',
            lineHeight: 1.4
          }}
        >
          <strong>Modo Organizar:</strong> arrastra desde el ícono <strong>⋮⋮</strong> hacia otro semestre (en celular puedes soltar directamente sobre las píldoras superiores) o toca cualquier tarjeta para reubicarla en 2 toques.
        </div>
      )}

      {/* Alerta de movimiento bloqueado */}
      {blockedBanner && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5',
            color: '#B91C1C',
            fontSize: '12px',
            fontWeight: 600
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{blockedBanner}</span>
          </div>
          <button
            onClick={() => setBlockedBanner(null)}
            aria-label="Cerrar alerta"
            style={{ background: 'none', border: 'none', color: '#B91C1C', cursor: 'pointer', padding: '2px' }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      <DndContext
        sensors={isOrganizeMode ? activeSensors : emptySensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {/* Selector Rápido de Semestre (Sticky Drop Targets en Modo Organizar) */}
        <div
          ref={pillsContainerRef}
          style={{
            position: isOrganizeMode ? 'sticky' : 'static',
            top: isOrganizeMode ? 0 : undefined,
            zIndex: isOrganizeMode ? 30 : undefined,
            backgroundColor: isOrganizeMode ? 'var(--bg-main)' : 'transparent',
            borderBottom: isOrganizeMode ? '1px solid var(--border-card)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflowX: 'auto',
            paddingTop: isOrganizeMode ? '8px' : '2px',
            paddingBottom: '8px',
            scrollBehavior: 'smooth',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap', marginRight: '4px' }}>
            {activeDragCode ? 'Soltar en:' : 'Ir a Semestre:'}
          </span>
          {visiblePeriods.map(p => (
            <DroppablePeriodPill
              key={p}
              periodNum={p}
              isSelected={selectedPeriod === p}
              isOrganizeMode={isOrganizeMode}
              isDraggingActive={activeDragCode !== null}
              evaluation={evaluationsByPeriod.get(p)}
              onClick={() => handlePeriodPillClick(p)}
            />
          ))}

          {isOrganizeMode && nextExtraPeriod !== null && (
            <DroppablePeriodPill
              periodNum={nextExtraPeriod}
              isSelected={false}
              isOrganizeMode={isOrganizeMode}
              isDraggingActive={activeDragCode !== null}
              evaluation={evaluationsByPeriod.get(nextExtraPeriod)}
              isExtraTrigger
              onClick={() => {
                const added = addExtraPeriod()
                if (added) {
                  setTimeout(() => handlePeriodPillClick(added), 50)
                }
              }}
            />
          )}
        </div>

        {/* Grilla Curricular de Semestres (9 oficiales + adicionales dinámicos) */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{
            display: 'flex',
            gap: isCompactView ? '8px' : `${Math.max(10, Math.round(20 * zoomScale))}px`,
            overflowX: 'auto',
            scrollSnapType: activeDragCode ? 'none' : 'x mandatory',
            paddingBottom: '20px',
            touchAction: 'pan-x pan-y',
            userSelect: 'none'
          }}
        >
          {visiblePeriods.map(periodNum => {
            const { regularCourses, interCourses } = getCoursesForColumn(periodNum)
            const totalRegularCredits = regularCourses.reduce((sum, c) => sum + c.credits, 0)
            const totalInterCredits = interCourses.reduce((sum, c) => sum + c.credits, 0)
            const hiddenDiagCount = courses.filter(
              c =>
                getDisplayColumnPeriod(getEffectivePeriod(c, plannedPeriodMap)) === periodNum &&
                c.is_diagnostic
            ).length
            const isOverLimit = totalRegularCredits > MAX_CREDITS_PER_SEMESTER
            const allColCourses = courses.filter(
              c => getDisplayColumnPeriod(getEffectivePeriod(c, plannedPeriodMap)) === periodNum
            )
            const unlockedInCol = allColCourses.filter(c => computedStateMap.get(c.code) !== 'locked')
            const allUnlockedCompleted =
              unlockedInCol.length > 0 &&
              unlockedInCol.every(c => computedStateMap.get(c.code) === 'completed')

            return (
              <DroppablePeriodColumn
                key={periodNum}
                periodNum={periodNum}
                colWidth={colWidth}
                isCompact={isCompact}
                isOrganizeMode={isOrganizeMode}
                isDraggingActive={activeDragCode !== null}
                evaluation={evaluationsByPeriod.get(periodNum)}
              >
                {/* Header de Columna de Semestre */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingBottom: isCompact ? '8px' : '12px',
                    borderBottom: '1px solid var(--border-card)'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'nowrap' }}>
                      <h2 style={{ fontSize: isCompact ? '13px' : '18px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        {periodNum}º Semestre
                      </h2>
                      {(periodNum === 5 || periodNum === 6) && (
                        <button
                          type="button"
                          onClick={() => setOpenInfoPeriod(prev => (prev === periodNum ? null : periodNum))}
                          aria-label={`Ver plazos de Opción de Grado en ${periodNum}º semestre`}
                          title="Ver plazos de Opción de Grado"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '18px',
                            height: '18px',
                            borderRadius: 'var(--radius-full)',
                            border: '1px solid rgba(217, 119, 6, 0.45)',
                            backgroundColor: openInfoPeriod === periodNum ? '#FEF3C7' : 'transparent',
                            color: '#D97706',
                            cursor: 'pointer',
                            padding: 0,
                            flexShrink: 0
                          }}
                        >
                          <Info size={11} />
                        </button>
                      )}
                      {periodNum > 9 && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: 'rgba(109, 134, 166, 0.14)',
                            color: 'var(--color-steel)'
                          }}
                        >
                          Adicional
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                      <p
                        style={{
                          fontSize: isCompact ? '11px' : '12px',
                          fontWeight: isOverLimit ? 700 : 500,
                          color: isOverLimit ? '#DC2626' : 'var(--text-secondary)'
                        }}
                      >
                        {totalRegularCredits}/{MAX_CREDITS_PER_SEMESTER} Cr. · {regularCourses.length} Asig.
                      </p>
                      {totalInterCredits > 0 && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: 'rgba(124, 58, 237, 0.12)',
                            color: '#7C3AED',
                            border: '1px solid rgba(124, 58, 237, 0.25)'
                          }}
                        >
                          +{totalInterCredits} Inter.
                        </span>
                      )}
                      {isOverLimit && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: '#FEE2E2',
                            color: '#DC2626'
                          }}
                        >
                          Excede 18 cr
                        </span>
                      )}
                      {gpaMetrics?.semesterGPAs[periodNum]?.gpa !== null &&
                        gpaMetrics?.semesterGPAs[periodNum]?.gpa !== undefined && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: 'var(--radius-full)',
                              backgroundColor: 'rgba(115, 72, 47, 0.12)',
                              color: 'var(--color-terracotta)',
                              border: '1px solid rgba(115, 72, 47, 0.25)',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            Prom: {gpaMetrics.semesterGPAs[periodNum].gpa?.toFixed(2)}
                          </span>
                        )}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={unlockedInCol.length === 0}
                    onPointerDown={e => e.stopPropagation()}
                    onTouchStart={e => e.stopPropagation()}
                    onClick={() => {
                      if (unlockedInCol.length === 0) return
                      if (allUnlockedCompleted) {
                        setPendingUncompletePeriod(periodNum)
                      } else {
                        setPendingCompletePeriod(periodNum)
                      }
                    }}
                    title={
                      unlockedInCol.length === 0
                        ? 'Todas las materias de este semestre están bloqueadas'
                        : allUnlockedCompleted
                          ? 'Desmarcar materias aprobadas del semestre'
                          : 'Completar materias desbloqueadas del semestre'
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      minWidth: '32px',
                      minHeight: '30px',
                      padding: isCompact ? '4px 8px' : '4px 8px',
                      borderRadius: 'var(--radius-sm)',
                      border: allUnlockedCompleted ? '1px solid var(--color-terracotta)' : '1px solid var(--border-card)',
                      backgroundColor: allUnlockedCompleted ? 'var(--color-terracotta)' : 'var(--bg-main)',
                      color: allUnlockedCompleted ? '#FFFFFF' : 'var(--color-steel)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: unlockedInCol.length === 0 ? 'not-allowed' : 'pointer',
                      opacity: unlockedInCol.length === 0 ? 0.45 : 1,
                      touchAction: 'manipulation'
                    }}
                  >
                    <CheckCheck size={14} color={allUnlockedCompleted ? '#FFFFFF' : 'var(--color-steel)'} />
                    {!isCompact && (allUnlockedCompleted ? 'Desmarcar' : 'Completar')}
                  </button>
                </div>

                {/* Alerta Mínima de Diagnósticos Ocultos */}
                {hideDiagnosticsInMalla && hiddenDiagCount > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'rgba(122, 152, 191, 0.10)',
                      border: '1px dashed var(--color-slate-mid)',
                      color: 'var(--text-secondary)',
                      fontSize: '11px',
                      fontWeight: 600
                    }}
                  >
                    <EyeOff size={13} color="var(--color-steel)" style={{ flexShrink: 0 }} />
                    <span>
                      {hiddenDiagCount} diagnóstic{hiddenDiagCount > 1 ? 'os' : 'o'} oculto{hiddenDiagCount > 1 ? 's' : ''} en este semestre
                    </span>
                  </div>
                )}

                {/* Lista de Tarjetas de Materia */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: isCompactView ? '6px' : isCompact ? '8px' : '12px' }}>
                  {regularCourses.length === 0 && interCourses.length === 0 ? (
                    <div
                      style={{
                        padding: '24px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px dashed var(--border-card)',
                        textAlign: 'center',
                        fontSize: '12px',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      Semestre vacío. Arrastra una materia aquí para planificarla.
                    </div>
                  ) : (
                    regularCourses.map(course => (
                      <DraggableCourseWrapper
                        key={course.code}
                        course={course}
                        isOrganizeMode={isOrganizeMode}
                        isCompactView={isCompactView}
                        effectivePeriod={getEffectivePeriod(course, plannedPeriodMap)}
                        hasPeriodConflict={samePeriodConflictCodes.has(course.code)}
                      />
                    ))
                  )}

                  <DroppableIntersemestralZone
                    basePeriod={periodNum}
                    interCourses={interCourses}
                    interCredits={totalInterCredits}
                    isCompact={isCompact}
                    isCompactView={isCompactView}
                    isOrganizeMode={isOrganizeMode}
                    isDraggingActive={activeDragCode !== null}
                    evaluation={evaluationsByPeriod.get(periodNum + 0.5)}
                    plannedPeriodMap={plannedPeriodMap}
                    samePeriodConflictCodes={samePeriodConflictCodes}
                  />
                </div>
              </DroppablePeriodColumn>
            )
          })}
        </div>

        {/* Overlay flotante fuera del contenedor overflow-x */}
        <DragOverlay dropAnimation={null}>
          {activeDragCourse ? (
            <div style={{ width: `${Math.min(colWidth - 24, 300)}px` }}>
              <CourseCard
                course={activeDragCourse}
                effectivePeriod={getEffectivePeriod(activeDragCourse, plannedPeriodMap)}
                isOverlay
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Modal informativo de Opción de Grado al tocar (i) en 5º o 6º semestre */}
      {openInfoPeriod !== null && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpenInfoPeriod(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 70,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-card)',
              boxShadow: 'var(--shadow-lg)',
              padding: '22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Info size={18} color="#D97706" />
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Plazos de Opción de Grado · {openInfoPeriod}º Semestre
                </h3>
              </div>
              <button
                onClick={() => setOpenInfoPeriod(null)}
                aria-label="Cerrar"
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }}
              >
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              {openInfoPeriod === 5
                ? 'Según el Art. 8 del Comité de Opciones de Trabajo de Grado, debes definir tu modalidad en 5º semestre: Pasantía hasta la semana 12; Monografía, Ruta Emprendimiento o Obra Artística hasta la semana 14.'
                : 'Según el Art. 8 del Comité de Opciones de Trabajo de Grado, la modalidad de Título de Especialización se presenta en la primera semana del 6º semestre (requiere componente de Profundización).'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setOpenInfoPeriod(null)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  backgroundColor: 'var(--color-terracotta)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de doble confirmación para completar todo un semestre */}
      {pendingCompletePeriod !== null && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPendingCompletePeriod(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 70,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-card)',
              boxShadow: 'var(--shadow-lg)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-card-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CheckCheck size={20} color="var(--color-terracotta)" />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  ¿Completar {pendingCompletePeriod}º Semestre?
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Se marcarán como aprobadas todas las materias desbloqueadas de este semestre.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <button
                onClick={() => setPendingCompletePeriod(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-card)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const p = pendingCompletePeriod
                  setPendingCompletePeriod(null)
                  await completeSemester(p)
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  backgroundColor: 'var(--color-terracotta)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Sí, completar semestre
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de doble confirmación para desmarcar todo un semestre */}
      {pendingUncompletePeriod !== null && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPendingUncompletePeriod(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 70,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-card)',
              boxShadow: 'var(--shadow-lg)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-md)', backgroundColor: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={20} color="#DC2626" />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  ¿Desmarcar {pendingUncompletePeriod}º Semestre?
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Se marcarán como pendientes todas las materias aprobadas de este semestre. Si alguna desbloqueaba materias posteriores, también se re-bloquearán en cascada.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <button
                onClick={() => setPendingUncompletePeriod(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-card)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const p = pendingUncompletePeriod
                  setPendingUncompletePeriod(null)
                  await uncompleteSemester(p)
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Sí, desmarcar semestre
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para movimientos con empuje en cascada o avisos */}
      {pendingMoveEval && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPendingMoveEval(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 70,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-card)',
              boxShadow: 'var(--shadow-lg)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-md)', backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={20} color="#D97706" />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Confirmar reorganización
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Mover <strong>{getCourse(pendingMoveEval.courseCode)?.name}</strong> de {formatPeriodLabel(pendingMoveEval.fromPeriod)} a {formatPeriodLabel(pendingMoveEval.targetPeriod)} ({pendingMoveEval.targetCreditsAfter}/{isIntersemestralPeriod(pendingMoveEval.targetPeriod) ? MAX_INTERSEMESTRAL_CREDITS : MAX_CREDITS_PER_SEMESTER} cr).
                </p>
              </div>
            </div>

            {pendingMoveEval.cascadeShifts.length > 0 && (
              <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-card)', fontSize: '12px' }}>
                <strong style={{ display: 'block', marginBottom: '6px', color: 'var(--text-primary)' }}>
                  Se desplazarán automáticamente {pendingMoveEval.cascadeShifts.length} materia{pendingMoveEval.cascadeShifts.length > 1 ? 's' : ''} dependiente{pendingMoveEval.cascadeShifts.length > 1 ? 's' : ''}:
                </strong>
                <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px', color: 'var(--text-secondary)' }}>
                  {pendingMoveEval.cascadeShifts.map(shift => (
                    <li key={shift.code}>
                      <strong style={{ color: 'var(--text-primary)' }}>{shift.name}</strong>: {formatPeriodLabel(shift.fromPeriod)} → {formatPeriodLabel(shift.toPeriod)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {pendingMoveEval.warnings.length > 0 && (
              <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', backgroundColor: '#FEF3C7', border: '1px solid #F59E0B', color: '#92400E', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {pendingMoveEval.warnings.map((w, i) => (
                  <p key={i} style={{ margin: 0, lineHeight: 1.4 }}>
                    • {w}
                  </p>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <button
                onClick={() => setPendingMoveEval(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-card)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const evalToRun = pendingMoveEval
                  setPendingMoveEval(null)
                  await executeMove(evalToRun)
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  backgroundColor: 'var(--color-terracotta)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Confirmar movimiento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
