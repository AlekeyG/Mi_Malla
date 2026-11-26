import React, { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { X, CheckCircle2, Zap, Swords, AlertCircle, ArrowLeft, ArrowRight, ArrowLeftRight, AlertTriangle, Eye } from 'lucide-react'
import { useCurriculum } from '../context/CurriculumContext'
import {
  getCourse,
  getPrerequisites,
  getUnlockedTargetCourses,
  getMinPassingGrade,
  getEffectivePeriod,
  getDisplayColumnPeriod,
  isIntersemestralPeriod,
  formatPeriodLabel,
  evaluateCourseMove,
  getAncestorPrerequisites,
  getAffectedDownstreamCourses,
  MAX_INTERSEMESTRAL_CREDITS,
  MAX_PLANNED_PERIOD
} from '../lib/curriculumEngine'
import type { Course, CourseStatusType, MoveEvaluationResult } from '../types/curriculum'

interface FormInputs {
  custom_name: string
  grade: string
}

export const CourseDrawer: React.FC = () => {
  const {
    inspectedCourseCode,
    setInspectedCourseCode,
    computedStateMap,
    userStatusMap,
    customNamesMap,
    gradesMap,
    plannedPeriodMap,
    visiblePeriods,
    moveCourseToPeriod,
    showCourseChainInMalla,
    setCourseStatus,
    setCourseExtras
  } = useCurriculum()

  const course = inspectedCourseCode ? getCourse(inspectedCourseCode) : undefined
  const state = course ? (computedStateMap.get(course.code) || 'locked') : 'locked'
  const effectivePeriod = course ? getEffectivePeriod(course, plannedPeriodMap) : 1
  const isIntersemestral = isIntersemestralPeriod(effectivePeriod)
  const displayColumnPeriod = getDisplayColumnPeriod(effectivePeriod)

  const prereqs = useMemo(() => (course ? getPrerequisites(course.code) : []), [course])
  const targets = useMemo(() => (course ? getUnlockedTargetCourses(course.code) : []), [course])
  const minGrade = course ? getMinPassingGrade(course) : 3.0

  const indirectPrereqs = useMemo(() => {
    if (!course) return []
    const directCodes = new Set(prereqs.map(p => p.code))
    const allAncestors = getAncestorPrerequisites(course.code)
    const list: Course[] = []
    for (const code of allAncestors) {
      if (!directCodes.has(code)) {
        const c = getCourse(code)
        if (c) list.push(c)
      }
    }
    return list.sort((a, b) => getEffectivePeriod(a, plannedPeriodMap) - getEffectivePeriod(b, plannedPeriodMap))
  }, [course, prereqs, plannedPeriodMap])

  const indirectTargets = useMemo(() => {
    if (!course) return []
    const directCodes = new Set(targets.map(t => t.code))
    const allDescendants = getAffectedDownstreamCourses(course.code)
    const list: Course[] = []
    for (const code of allDescendants) {
      if (!directCodes.has(code)) {
        const c = getCourse(code)
        if (c) list.push(c)
      }
    }
    return list.sort((a, b) => getEffectivePeriod(a, plannedPeriodMap) - getEffectivePeriod(b, plannedPeriodMap))
  }, [course, targets, plannedPeriodMap])

  const [moveFeedbackError, setMoveFeedbackError] = useState<string | null>(null)
  const [pendingMoveConfirm, setPendingMoveConfirm] = useState<MoveEvaluationResult | null>(null)

  const moveOptions = useMemo(() => {
    if (!course) return []
    const lastPeriod = visiblePeriods[visiblePeriods.length - 1] ?? 9
    const periodsList =
      lastPeriod < MAX_PLANNED_PERIOD ? [...visiblePeriods, lastPeriod + 1] : visiblePeriods
    return periodsList.map(p => ({
      period: p,
      isExtraOption: p > lastPeriod,
      evaluation: evaluateCourseMove(course.code, p, plannedPeriodMap)
    }))
  }, [course, visiblePeriods, plannedPeriodMap])

  const { register, handleSubmit, reset, watch } = useForm<FormInputs>()

  const watchedGrade = watch('grade')
  const inputGradeNum = watchedGrade !== undefined && watchedGrade !== '' ? parseFloat(watchedGrade) : undefined
  const isInputFailing = inputGradeNum !== undefined && !isNaN(inputGradeNum) && inputGradeNum < minGrade

  useEffect(() => {
    if (course) {
      reset({
        custom_name: customNamesMap.get(course.code) || '',
        grade: gradesMap.get(course.code)?.toString() || ''
      })
      setMoveFeedbackError(null)
      setPendingMoveConfirm(null)
    }
  }, [course, inspectedCourseCode, customNamesMap, gradesMap, reset])

  const handleSelectTargetPeriod = async (evaluation: MoveEvaluationResult) => {
    if (!course) return
    if (evaluation.targetPeriod === effectivePeriod) return
    setMoveFeedbackError(null)

    if (!evaluation.allowed) {
      setPendingMoveConfirm(null)
      setMoveFeedbackError(evaluation.reason || 'No se puede mover a este semestre.')
      return
    }

    if (evaluation.cascadeShifts.length > 0 || evaluation.warnings.length > 0) {
      setPendingMoveConfirm(evaluation)
      return
    }

    setPendingMoveConfirm(null)
    await moveCourseToPeriod(course.code, evaluation.targetPeriod)
  }

  const handleConfirmPendingMove = async () => {
    if (!course || !pendingMoveConfirm) return
    await moveCourseToPeriod(course.code, pendingMoveConfirm.targetPeriod)
    setPendingMoveConfirm(null)
    setMoveFeedbackError(null)
  }

  const onSubmit = async (data: FormInputs) => {
    if (!course) return
    const gradeNum = data.grade ? parseFloat(data.grade) : undefined
    await setCourseExtras(course.code, {
      custom_name: data.custom_name.trim() || undefined,
      grade: gradeNum
    })
    setInspectedCourseCode(null)
  }

  const handleStatusChange = async (newStatus: CourseStatusType) => {
    if (!course) return
    await setCourseStatus(course.code, newStatus)
  }

  return (
    <AnimatePresence>
      {inspectedCourseCode && course && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => setInspectedCourseCode(null)}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '440px',
              height: '100%',
              backgroundColor: 'var(--bg-card)',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              padding: '24px'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: isIntersemestral ? '#7C3AED' : 'var(--color-steel)', textTransform: 'uppercase' }}>
                  Semestre {displayColumnPeriod}
                  {isIntersemestral ? ' · Intersemestral' : ''}
                  {effectivePeriod !== course.period ? ` (Oficial: ${course.period}º)` : ''} · {course.code}
                </span>
                <h2 style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px', color: 'var(--text-primary)' }}>
                  {customNamesMap.get(course.code) || course.name}
                </h2>
              </div>
              <button
                onClick={() => setInspectedCourseCode(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-secondary)' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Course Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '20px' }}>
              <div style={{ padding: '10px 6px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-main)', textAlign: 'center' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block' }}>Créditos</span>
                <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>{course.credits}</strong>
              </div>
              <div style={{ padding: '10px 6px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-main)', textAlign: 'center' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block' }}>Categoría</span>
                <strong style={{ fontSize: '11px', color: 'var(--text-terracotta)' }}>
                  {{
                    core: 'Disciplinar',
                    diagnostic: 'Diagnóstico',
                    general_education: 'Formación Gen.',
                    elective: 'Electiva',
                    specialization: 'Énfasis',
                    capstone: 'Opción Grado'
                  }[course.category] ?? course.category}
                </strong>
              </div>
              <div
                style={{
                  padding: '10px 6px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: minGrade === 3.5 ? 'rgba(220, 38, 38, 0.08)' : 'var(--bg-main)',
                  border: minGrade === 3.5 ? '1px solid rgba(220, 38, 38, 0.25)' : 'none',
                  textAlign: 'center'
                }}
              >
                <span style={{ fontSize: '10px', color: minGrade === 3.5 ? '#DC2626' : 'var(--text-secondary)', display: 'block', fontWeight: minGrade === 3.5 ? 700 : 400 }}>
                  Nota Mín.
                </span>
                <strong style={{ fontSize: '15px', color: minGrade === 3.5 ? '#DC2626' : 'var(--text-primary)' }}>
                  {minGrade.toFixed(1)}
                </strong>
              </div>
            </div>

            {/* Capstone / Opción de Grado Official Deadlines */}
            {course.category === 'capstone' && (
              <div
                style={{
                  marginBottom: '20px',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#FEF3C7',
                  border: '1px solid #F59E0B',
                  color: '#92400E',
                  fontSize: '11px',
                  lineHeight: 1.45
                }}
              >
                <strong style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                  Plazos oficiales para definir Opción de Grado (Art. 8 Comité):
                </strong>
                <ul style={{ margin: 0, paddingLeft: '16px' }}>
                  <li><strong>Pasantía:</strong> semana 12 del 5º semestre (requiere haber aprobado todos los CADI y CAI).</li>
                  <li><strong>Monografía, Emprendimiento u Obra:</strong> semana 14 del 5º semestre.</li>
                  <li><strong>Título de Especialización:</strong> semana 1 del 6º semestre (requiere componente de Profundización).</li>
                </ul>
              </div>
            )}

            {/* State Switcher Buttons */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                Estado de Asignatura:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleStatusChange('completed')}
                  disabled={state === 'locked'}
                  style={{
                    padding: '10px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    backgroundColor: state === 'completed' ? 'var(--color-terracotta)' : 'var(--bg-main)',
                    color: state === 'completed' ? '#FFFFFF' : 'var(--text-primary)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: state === 'locked' ? 'not-allowed' : 'pointer',
                    opacity: state === 'locked' ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    touchAction: 'manipulation'
                  }}
                >
                  <CheckCircle2 size={16} /> Aprobada
                </button>

                <button
                  type="button"
                  onClick={() => handleStatusChange('in_progress')}
                  disabled={state === 'locked'}
                  style={{
                    padding: '10px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    backgroundColor: state === 'in_progress' ? 'var(--color-slate-mid)' : 'var(--bg-main)',
                    color: state === 'in_progress' ? '#FFFFFF' : 'var(--text-primary)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: state === 'locked' ? 'not-allowed' : 'pointer',
                    opacity: state === 'locked' ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    touchAction: 'manipulation'
                  }}
                >
                  <Swords size={16} /> En Curso
                </button>

                <button
                  type="button"
                  onClick={() => handleStatusChange('pending')}
                  disabled={state === 'locked'}
                  style={{
                    padding: '10px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    backgroundColor: state === 'unlocked' ? 'var(--bg-card-muted)' : 'var(--bg-main)',
                    color: 'var(--text-primary)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: state === 'locked' ? 'not-allowed' : 'pointer',
                    opacity: state === 'locked' ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    touchAction: 'manipulation'
                  }}
                >
                  <Zap size={16} /> Pendiente
                </button>

                <button
                  type="button"
                  onClick={() => handleStatusChange('failed')}
                  disabled={state === 'locked'}
                  style={{
                    padding: '10px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    backgroundColor: state === 'failed' ? '#FEE2E2' : 'var(--bg-main)',
                    color: state === 'failed' ? '#DC2626' : 'var(--text-primary)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: state === 'locked' ? 'not-allowed' : 'pointer',
                    opacity: state === 'locked' ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    touchAction: 'manipulation'
                  }}
                >
                  <AlertCircle size={16} /> Por Nivelar
                </button>
              </div>
            </div>

            {/* Quick Reorganize Semester Section (Accessible 1-handed mobile & PC) */}
            <div style={{ marginBottom: '20px', padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-card)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ArrowLeftRight size={14} color="var(--color-terracotta)" /> Reubicar semestre (máx. 18 cr):
                </span>
                {effectivePeriod !== course.period && (
                  <button
                    type="button"
                    onClick={() => {
                      const officialEval = evaluateCourseMove(course.code, course.period, plannedPeriodMap)
                      handleSelectTargetPeriod(officialEval)
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-terracotta)',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    Volver al {course.period}º
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                {moveOptions.map(({ period, isExtraOption, evaluation }) => {
                  const isCurrent = period === effectivePeriod
                  const isWarnOrCascade = evaluation.allowed && (evaluation.severity === 'cascade' || evaluation.severity === 'warning')
                  const isBlocked = !evaluation.allowed

                  return (
                    <button
                      key={period}
                      type="button"
                      onClick={() => handleSelectTargetPeriod(evaluation)}
                      title={
                        isCurrent
                          ? 'Semestre actual'
                          : isBlocked
                            ? evaluation.reason
                            : isWarnOrCascade
                              ? 'Requiere confirmación (cascada o aviso)'
                              : `Mover al ${period}º semestre`
                      }
                      style={{
                        padding: '7px 4px',
                        borderRadius: 'var(--radius-sm)',
                        border: isCurrent
                          ? '2px solid var(--color-terracotta)'
                          : isBlocked
                            ? '1px dashed rgba(220, 38, 38, 0.35)'
                            : isWarnOrCascade
                              ? '1px solid #F59E0B'
                              : '1px solid var(--border-card)',
                        backgroundColor: isCurrent
                          ? 'var(--color-terracotta)'
                          : isBlocked
                            ? 'rgba(220, 38, 38, 0.06)'
                            : isWarnOrCascade
                              ? 'rgba(245, 158, 11, 0.12)'
                              : 'var(--bg-card)',
                        color: isCurrent
                          ? '#FFFFFF'
                          : isBlocked
                            ? '#B91C1C'
                            : isWarnOrCascade
                              ? '#B45309'
                              : 'var(--text-primary)',
                        fontWeight: 700,
                        fontSize: '12px',
                        opacity: isBlocked ? 0.65 : 1,
                        cursor: isCurrent ? 'default' : 'pointer'
                      }}
                    >
                      {isExtraOption ? `+${period}º` : `${period}º`}
                    </button>
                  )
                })}
              </div>

              {/* Intersemestral toggle for current column */}
              <button
                type="button"
                onClick={() => {
                  const targetP = isIntersemestral ? displayColumnPeriod : displayColumnPeriod + 0.5
                  const evalInter = evaluateCourseMove(course.code, targetP, plannedPeriodMap)
                  handleSelectTargetPeriod(evalInter)
                }}
                style={{
                  marginTop: '8px',
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: isIntersemestral ? '2px solid #7C3AED' : '1px dashed rgba(124, 58, 237, 0.5)',
                  backgroundColor: isIntersemestral ? '#EDE9FE' : 'rgba(124, 58, 237, 0.06)',
                  color: '#6D28D9',
                  fontWeight: 700,
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                {isIntersemestral
                  ? `✓ En Intersemestral (post ${displayColumnPeriod}º) — Pasar a semestre regular`
                  : `Cursar en Intersemestral (post ${displayColumnPeriod}º · máx. ${MAX_INTERSEMESTRAL_CREDITS} cr)`}
              </button>

              {moveFeedbackError && (
                <p style={{ marginTop: '8px', fontSize: '11px', fontWeight: 600, color: '#DC2626', display: 'flex', alignItems: 'flex-start', gap: '5px' }}>
                  <AlertCircle size={13} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <span>{moveFeedbackError}</span>
                </p>
              )}

              {pendingMoveConfirm && (
                <div style={{ marginTop: '10px', padding: '10px', borderRadius: 'var(--radius-sm)', backgroundColor: '#FEF3C7', border: '1px solid #F59E0B', color: '#92400E', fontSize: '11px' }}>
                  <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                    <AlertTriangle size={13} />
                    Confirmar movimiento a {formatPeriodLabel(pendingMoveConfirm.targetPeriod)}
                  </div>
                  {pendingMoveConfirm.cascadeShifts.length > 0 && (
                    <div style={{ marginBottom: '6px' }}>
                      <span style={{ fontWeight: 600 }}>Materias dependientes que se desplazarán:</span>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        {pendingMoveConfirm.cascadeShifts.map(s => (
                          <li key={s.code}>
                            {s.name}: {formatPeriodLabel(s.fromPeriod)} → {formatPeriodLabel(s.toPeriod)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {pendingMoveConfirm.warnings.map((w, idx) => (
                    <p key={idx} style={{ margin: '4px 0 0', lineHeight: 1.35 }}>
                      • {w}
                    </p>
                  ))}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setPendingMoveConfirm(null)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid #D97706',
                        backgroundColor: 'transparent',
                        color: '#92400E',
                        fontWeight: 600,
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmPendingMove}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        backgroundColor: '#D97706',
                        color: '#FFFFFF',
                        fontWeight: 700,
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Chain Analysis: Prereqs & Unlocks */}
            <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(prereqs.length > 0 || targets.length > 0) && (
                <button
                  type="button"
                  onClick={() => showCourseChainInMalla(course.code)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-terracotta)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--color-terracotta)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    touchAction: 'manipulation'
                  }}
                >
                  <Eye size={15} />
                  Ver ruta en la malla
                </button>
              )}
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <ArrowLeft size={14} /> Requisitos Previos Requeridos:
                </h4>
                {prereqs.length === 0 ? (
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Ninguno (Ingreso directo)</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {prereqs.map(p => {
                      const pDone = userStatusMap.get(p.code) === 'completed'
                      return (
                        <div
                          key={p.code}
                          style={{
                            fontSize: '12px',
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'var(--bg-card-muted)',
                            border: `1px solid ${pDone ? 'rgba(21, 128, 61, 0.4)' : 'rgba(185, 28, 28, 0.3)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px'
                          }}
                        >
                          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                            {p.name} ({p.code})
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-full)',
                              backgroundColor: pDone ? 'rgba(21, 128, 61, 0.15)' : 'rgba(185, 28, 28, 0.15)',
                              color: pDone ? '#16A34A' : '#EF4444',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {pDone ? '✓ Cumplido' : 'Pendiente'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
                {indirectPrereqs.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#D97706', display: 'block', marginBottom: '4px' }}>
                      Cadena previa (indirectos):
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {indirectPrereqs.map(p => (
                        <span
                          key={p.code}
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: 'rgba(217, 119, 6, 0.08)',
                            border: '1px solid rgba(217, 119, 6, 0.35)',
                            color: '#B45309'
                          }}
                        >
                          {p.name} (Sem {getEffectivePeriod(p, plannedPeriodMap)})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <ArrowRight size={14} color="#0D9488" /> Asignaturas que Desbloquea a Futuro:
                </h4>
                {targets.length === 0 ? (
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Ninguna (Asignatura terminal)</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {targets.map(t => (
                        <span
                          key={t.code}
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '4px 8px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: 'rgba(13, 148, 136, 0.10)',
                            border: '1px solid rgba(13, 148, 136, 0.35)',
                            color: '#0F766E'
                          }}
                        >
                          {t.name} (Sem {getEffectivePeriod(t, plannedPeriodMap)})
                        </span>
                      ))}
                    </div>

                    {indirectTargets.length > 0 && (
                      <div>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#0D9488', display: 'block', marginBottom: '4px' }}>
                          Cadena posterior (indirectas):
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {indirectTargets.map(t => (
                            <span
                              key={t.code}
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                padding: '3px 8px',
                                borderRadius: 'var(--radius-full)',
                                backgroundColor: 'var(--bg-main)',
                                border: '1px dashed rgba(13, 148, 136, 0.45)',
                                color: '#0F766E'
                              }}
                            >
                              {t.name} (Sem {getEffectivePeriod(t, plannedPeriodMap)})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Custom Form for Electives & Grade */}
            <form onSubmit={handleSubmit(onSubmit)} style={{ marginTop: 'auto', borderTop: '1px solid var(--border-card)', paddingTop: '16px' }}>
              {course.is_elective && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Nombre Personalizado de Electiva:
                  </label>
                  <input
                    {...register('custom_name')}
                    placeholder="Ej. Comercio Electrónico"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-card)',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-primary)',
                      fontSize: '13px'
                    }}
                  />
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Nota / Calificación Referencial:
                  </label>
                  {state === 'completed' && !course.is_diagnostic && gradesMap.get(course.code) === undefined && (
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#D97706', backgroundColor: 'rgba(217, 119, 6, 0.12)', padding: '2px 6px', borderRadius: 'var(--radius-full)' }}>
                      Sin nota
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  {...register('grade')}
                  placeholder="Ej. 4.5"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: isInputFailing ? '2px solid #DC2626' : '1px solid var(--border-card)',
                    backgroundColor: isInputFailing ? '#FEF2F2' : 'var(--bg-main)',
                    color: isInputFailing ? '#DC2626' : 'var(--text-primary)',
                    fontSize: '13px',
                    fontWeight: isInputFailing ? 700 : 400
                  }}
                />
                {isInputFailing && (
                  <p style={{ fontSize: '11px', color: '#DC2626', fontWeight: 600, marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={13} style={{ flexShrink: 0 }} />
                    Nota por debajo del mínimo exigido ({minGrade.toFixed(1)}) según Art. 42 REA.
                  </p>
                )}
                {inputGradeNum !== undefined && !isNaN(inputGradeNum) && !isInputFailing && (
                  <p style={{ fontSize: '11px', color: '#16A34A', fontWeight: 600, marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    ✓ Nota suficiente para aprobar (mínimo {minGrade.toFixed(1)}).
                  </p>
                )}
              </div>

              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  backgroundColor: 'var(--color-terracotta)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Guardar Cambios
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
