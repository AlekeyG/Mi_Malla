import rawSeedData from '../../seed_data.json'
import {
  ZCurriculumSeed,
  type CurriculumSeed,
  type Course,
  type CourseStatusType,
  type ComputedCourseState,
  type CascadeShift,
  type MoveEvaluationResult,
  type MoveSeverity
} from '../types/curriculum'

export const MAX_CREDITS_PER_SEMESTER = 18
export const MAX_INTERSEMESTRAL_CREDITS = 6
export const MAX_PLANNED_PERIOD = 16

// ==========================================================================
// SEED HYDRATION & MAP INDEXING IN RAM (O(1) Latency)
// ==========================================================================

const validatedSeed: CurriculumSeed = ZCurriculumSeed.parse(rawSeedData)

const courseMap = new Map<string, Course>()
const periodMap = new Map<number, Course[]>()
const prereqMap = new Map<string, string[]>()
const unlocksMap = new Map<string, string[]>()

// Index courses in RAM
for (const course of validatedSeed.courses) {
  courseMap.set(course.code, course)

  // Group by period
  const list = periodMap.get(course.period) || []
  list.push(course)
  periodMap.set(course.period, list)

  // Prereqs
  prereqMap.set(course.code, course.prereqs || [])
}

// Ensure diagnostic courses are sorted at the end of each period list
for (const list of periodMap.values()) {
  list.sort((a, b) => {
    if (a.is_diagnostic === b.is_diagnostic) return 0
    return a.is_diagnostic ? 1 : -1
  })
}

// Build reverse unlock graph (unlocksMap)
for (const course of validatedSeed.courses) {
  for (const prereqCode of course.prereqs) {
    const list = unlocksMap.get(prereqCode) || []
    if (!list.includes(course.code)) {
      list.push(course.code)
    }
    unlocksMap.set(prereqCode, list)
  }
}

// ==========================================================================
// CURRICULUM ENGINE EXPORTED METHODS
// ==========================================================================

export function getCurriculumSeed(): CurriculumSeed {
  return validatedSeed
}

export function getAllCourses(): Course[] {
  return validatedSeed.courses
}

export function getCourse(code: string): Course | undefined {
  return courseMap.get(code)
}

export function getCoursesByPeriod(period: number): Course[] {
  return periodMap.get(period) || []
}

export function getEffectivePeriod(course: Course, plannedPeriodMap?: Map<string, number>): number {
  return plannedPeriodMap?.get(course.code) ?? course.period
}

export function isIntersemestralPeriod(period: number): boolean {
  return Math.abs(period - Math.floor(period)) === 0.5
}

export function getDisplayColumnPeriod(period: number): number {
  return Math.floor(period)
}

export function formatPeriodLabel(period: number): string {
  if (isIntersemestralPeriod(period)) {
    const base = Math.floor(period)
    return `Intersemestral (post ${base}º)`
  }
  return `${period}º semestre`
}

/**
 * Evaluates whether moving `courseCode` to `targetPeriod` is academically valid.
 * Supports regular semesters (1..16) and intersemestral periods (N + 0.5).
 * Checks prerequisite ordering, computes downstream BFS cascade shifts,
 * enforces MAX_CREDITS_PER_SEMESTER (18 cr) or MAX_INTERSEMESTRAL_CREDITS (6 cr),
 * and collects soft academic warnings.
 */
export function evaluateCourseMove(
  courseCode: string,
  targetPeriod: number,
  plannedPeriodMap: Map<string, number>
): MoveEvaluationResult {
  const course = courseMap.get(courseCode)
  const isValidHalfStep = Number.isInteger(targetPeriod * 2)
  if (!course || !isValidHalfStep || targetPeriod < 1 || targetPeriod > MAX_PLANNED_PERIOD + 0.5) {
    return {
      allowed: false,
      severity: 'blocked',
      courseCode,
      fromPeriod: course?.period ?? 1,
      targetPeriod,
      reason: !course
        ? 'Materia no encontrada en el plan de estudios.'
        : `El semestre destino debe estar entre 1º y ${MAX_PLANNED_PERIOD}º.`,
      warnings: [],
      cascadeShifts: [],
      targetCreditsAfter: 0,
      overflowPeriodsAfter: []
    }
  }

  const fromPeriod = getEffectivePeriod(course, plannedPeriodMap)
  if (targetPeriod === fromPeriod) {
    let currentCredits = 0
    for (const c of validatedSeed.courses) {
      if (getEffectivePeriod(c, plannedPeriodMap) === targetPeriod) {
        currentCredits += c.credits
      }
    }
    return {
      allowed: true,
      severity: 'valid',
      courseCode,
      fromPeriod,
      targetPeriod,
      warnings: [],
      cascadeShifts: [],
      targetCreditsAfter: currentCredits,
      overflowPeriodsAfter: []
    }
  }

  // 1. Prerequisite check: strictly earlier is valid; same period is allowed with conflict warning; earlier than prereq is blocked
  const samePeriodPrereqWarnings: string[] = []
  const prereqs = prereqMap.get(courseCode) || []
  for (const pCode of prereqs) {
    const pCourse = courseMap.get(pCode)
    if (!pCourse) continue
    const pPeriod = getEffectivePeriod(pCourse, plannedPeriodMap)
    if (pPeriod > targetPeriod) {
      return {
        allowed: false,
        severity: 'blocked',
        courseCode,
        fromPeriod,
        targetPeriod,
        reason: `Requiere "${pCourse.name}" antes (actualmente en ${formatPeriodLabel(pPeriod)}).`,
        warnings: [],
        cascadeShifts: [],
        targetCreditsAfter: 0,
        overflowPeriodsAfter: []
      }
    }
    if (pPeriod === targetPeriod) {
      samePeriodPrereqWarnings.push(
        `Quedará en el mismo semestre que su prerrequisito "${pCourse.name}".`
      )
    }
  }

  // 2. Build simulated period assignment map and run BFS cascade push on downstream dependents
  const nextPeriods = new Map<string, number>()
  for (const c of validatedSeed.courses) {
    nextPeriods.set(c.code, getEffectivePeriod(c, plannedPeriodMap))
  }
  nextPeriods.set(courseCode, targetPeriod)

  const queue: string[] = [courseCode]
  while (queue.length > 0) {
    const currCode = queue.shift()!
    const currPeriod = nextPeriods.get(currCode)!
    const dependents = unlocksMap.get(currCode) || []

    for (const depCode of dependents) {
      const depPeriod = nextPeriods.get(depCode)!
      if (depPeriod <= currPeriod) {
        const pushedPeriod = Math.floor(currPeriod) + 1
        if (pushedPeriod > MAX_PLANNED_PERIOD) {
          const depCourse = courseMap.get(depCode)
          return {
            allowed: false,
            severity: 'blocked',
            courseCode,
            fromPeriod,
            targetPeriod,
            reason: `"${depCourse?.name ?? depCode}" superaría el límite máximo de ${MAX_PLANNED_PERIOD} semestres.`,
            warnings: [],
            cascadeShifts: [],
            targetCreditsAfter: 0,
            overflowPeriodsAfter: []
          }
        }
        nextPeriods.set(depCode, pushedPeriod)
        queue.push(depCode)
      }
    }
  }

  // Collect cascade shifts (excluding the primary moved course)
  const cascadeShifts: CascadeShift[] = []
  for (const c of validatedSeed.courses) {
    if (c.code === courseCode) continue
    const oldP = getEffectivePeriod(c, plannedPeriodMap)
    const newP = nextPeriods.get(c.code)!
    if (oldP !== newP) {
      cascadeShifts.push({
        code: c.code,
        name: c.name,
        credits: c.credits,
        fromPeriod: oldP,
        toPeriod: newP
      })
    }
  }
  cascadeShifts.sort((a, b) => a.fromPeriod - b.fromPeriod || a.toPeriod - b.toPeriod)

  // 3. Calculate resulting credits per semester after cascade shifts
  const creditsByPeriod = new Map<number, number>()
  for (const c of validatedSeed.courses) {
    const p = nextPeriods.get(c.code)!
    creditsByPeriod.set(p, (creditsByPeriod.get(p) || 0) + c.credits)
  }

  const targetCreditsAfter = creditsByPeriod.get(targetPeriod) || 0
  const isTargetInter = isIntersemestralPeriod(targetPeriod)
  const targetMaxCredits = isTargetInter ? MAX_INTERSEMESTRAL_CREDITS : MAX_CREDITS_PER_SEMESTER

  const warnings: string[] = [...samePeriodPrereqWarnings]
  const overflowPeriodsAfter: Array<{ period: number; credits: number }> = []

  if (course.credits > 0 && targetCreditsAfter > targetMaxCredits) {
    overflowPeriodsAfter.push({ period: targetPeriod, credits: targetCreditsAfter })
    warnings.push(
      isTargetInter
        ? `El ${formatPeriodLabel(targetPeriod)} quedará con ${targetCreditsAfter}/${MAX_INTERSEMESTRAL_CREDITS} créditos. Recuerda balancearlo luego.`
        : `El ${targetPeriod}º semestre quedará con ${targetCreditsAfter}/${MAX_CREDITS_PER_SEMESTER} créditos. Recuerda mover otra materia al siguiente semestre.`
    )
  }

  // Check if any secondary semester impacted by cascade exceeds 18 credits
  const shiftedTargets = new Set(cascadeShifts.map(s => s.toPeriod))
  const cascadeOverflowPeriods: Array<{ period: number; credits: number }> = []
  for (const p of shiftedTargets) {
    if (p === targetPeriod) continue
    const cr = creditsByPeriod.get(p) || 0
    if (cr > MAX_CREDITS_PER_SEMESTER) {
      overflowPeriodsAfter.push({ period: p, credits: cr })
      cascadeOverflowPeriods.push({ period: p, credits: cr })
    }
  }
  overflowPeriodsAfter.sort((a, b) => a.period - b.period)
  cascadeOverflowPeriods.sort((a, b) => a.period - b.period)

  // 4. Soft academic warnings
  if (cascadeOverflowPeriods.length > 0) {
    const summary = cascadeOverflowPeriods.map(o => `${o.period}º (${o.credits}/18 cr)`).join(', ')
    warnings.push(
      `Por el desplazamiento en cascada, quedarían con sobrecarga de créditos: ${summary}. Recuerda balancearlos luego.`
    )
  }

  if ((course.category === 'capstone' || course.category === 'specialization') && targetPeriod < 7) {
    warnings.push(
      'Esta asignatura de culminación suele exigir un alto porcentaje de créditos aprobados en la facultad (recomendado 7º a 9º).'
    )
  } else if (course.prereqs.length === 0 && course.period >= 5 && course.period - targetPeriod >= 3) {
    warnings.push(
      'Esta materia oficial no tiene prerrequisito directo, pero verifica en tu facultad si exige mínimo de créditos acumulados.'
    )
  }

  let severity: MoveSeverity = 'valid'
  if (cascadeShifts.length > 0) {
    severity = 'cascade'
  } else if (warnings.length > 0) {
    severity = 'warning'
  }

  return {
    allowed: true,
    severity,
    courseCode,
    fromPeriod,
    targetPeriod,
    warnings,
    cascadeShifts,
    targetCreditsAfter,
    overflowPeriodsAfter
  }
}

export function getSamePeriodPrereqConflicts(plannedPeriodMap: Map<string, number>): Set<string> {
  const conflicts = new Set<string>()
  for (const c of validatedSeed.courses) {
    const cPeriod = getEffectivePeriod(c, plannedPeriodMap)
    const prereqs = prereqMap.get(c.code) || []
    for (const pCode of prereqs) {
      const pCourse = courseMap.get(pCode)
      if (!pCourse) continue
      if (getEffectivePeriod(pCourse, plannedPeriodMap) === cPeriod) {
        conflicts.add(c.code)
        conflicts.add(pCode)
      }
    }
  }
  return conflicts
}

export function getPrerequisites(code: string): Course[] {
  const codes = prereqMap.get(code) || []
  return codes.map(c => courseMap.get(c)).filter((c): c is Course => c !== undefined)
}

export function getUnlockedTargetCourses(code: string): Course[] {
  const codes = unlocksMap.get(code) || []
  return codes.map(c => courseMap.get(c)).filter((c): c is Course => c !== undefined)
}

/**
 * Returns minimum passing grade required according to Reglamento Estudiantil (Art. 42 REA).
 * General rule: 3.0 (60% REA).
 * Special cases: 3.5 (70% REA) for Lengua Extranjera (CAI), Ciudadanía Siglo 21 (CAI),
 * Cátedra Generación Siglo 21 (CAI), and Prácticas profesionales/pedagógicas/educativas (CADI).
 */
export function getMinPassingGrade(course: Course): number {
  if (course.is_diagnostic) return 3.0

  const nameLower = course.name.toLowerCase()
  const codeUpper = course.code.toUpperCase()
  const fieldLower = (course.learning_field || '').toLowerCase()

  // Lengua Extranjera (CAI) / Inglés
  if (
    fieldLower === 'idiomas' ||
    nameLower.includes('lengua extranjera') ||
    nameLower.includes('inglés') ||
    nameLower.includes('ingles')
  ) {
    return 3.5
  }

  // Ciudadanía Siglo 21 (CAI)
  if (
    nameLower.includes('ciudadanía') ||
    nameLower.includes('ciudadania') ||
    codeUpper.includes('CAI1002020303')
  ) {
    return 3.5
  }

  // Cátedra Generación Siglo 21 (CAI)
  if (
    nameLower.includes('cátedra generación') ||
    nameLower.includes('catedra generacion') ||
    codeUpper.includes('CAI1002020609')
  ) {
    return 3.5
  }

  // Prácticas profesionales, pedagógicas o educativas (CADI)
  if (nameLower.includes('práctica') || nameLower.includes('practica')) {
    return 3.5
  }

  return 3.0
}

export function isGradePassing(course: Course, grade: number): boolean {
  return grade >= getMinPassingGrade(course)
}

/**
 * Calculates the exact computed state for a course based on the student's status map.
 */
export function calculateCourseState(
  courseCode: string,
  userStatusMap: Map<string, CourseStatusType>
): ComputedCourseState {
  const userStatus = userStatusMap.get(courseCode)

  if (userStatus === 'completed') return 'completed'
  if (userStatus === 'in_progress') return 'in_progress'
  if (userStatus === 'failed') return 'failed'

  const prereqs = prereqMap.get(courseCode) || []
  if (prereqs.length === 0) {
    return 'unlocked'
  }

  // All prereqs must be marked as completed
  const allPrereqsMet = prereqs.every(reqCode => userStatusMap.get(reqCode) === 'completed')
  return allPrereqsMet ? 'unlocked' : 'locked'
}

/**
 * RECURSIVE REVERSE GRAPH TRAVERSAL (BFS/DFS)
 * Finds ALL downstream courses that depend directly or indirectly on `courseCode`.
 * Used for safe cascade rollback when a student unchecks a course.
 */
export function getAffectedDownstreamCourses(courseCode: string): Set<string> {
  const affected = new Set<string>()
  const queue: string[] = [courseCode]

  while (queue.length > 0) {
    const current = queue.shift()!
    const directDependents = unlocksMap.get(current) || []

    for (const depCode of directDependents) {
      if (!affected.has(depCode)) {
        affected.add(depCode)
        queue.push(depCode)
      }
    }
  }

  return affected
}

/**
 * RECURSIVE BACKWARD GRAPH TRAVERSAL (BFS/DFS)
 * Finds ALL prerequisite courses required directly or indirectly before `courseCode`.
 * Used for backward Chain Glow highlighting (Predecessors).
 */
export function getAncestorPrerequisites(courseCode: string): Set<string> {
  const ancestors = new Set<string>()
  const queue: string[] = [courseCode]

  while (queue.length > 0) {
    const current = queue.shift()!
    const directPrereqs = prereqMap.get(current) || []

    for (const pCode of directPrereqs) {
      if (!ancestors.has(pCode)) {
        ancestors.add(pCode)
        queue.push(pCode)
      }
    }
  }

  return ancestors
}

/**
 * Calculates total credits and breakdown by area/category
 */
export function calculateCurriculumMetrics(userStatusMap: Map<string, CourseStatusType>) {
  let completedCredits = 0
  let totalCredits = 0
  let completedCoursesCount = 0

  const creditsByField: Record<string, { completed: number; total: number }> = {}

  for (const field of validatedSeed.learning_fields) {
    creditsByField[field] = { completed: 0, total: 0 }
  }

  for (const course of validatedSeed.courses) {
    totalCredits += course.credits

    if (course.learning_field && creditsByField[course.learning_field]) {
      creditsByField[course.learning_field].total += course.credits
    }

    if (userStatusMap.get(course.code) === 'completed') {
      completedCredits += course.credits
      completedCoursesCount++

      if (course.learning_field && creditsByField[course.learning_field]) {
        creditsByField[course.learning_field].completed += course.credits
      }
    }
  }

  const completionPercentage = totalCredits > 0 ? (completedCredits / totalCredits) * 100 : 0

  return {
    completedCredits,
    totalCredits,
    completedCoursesCount,
    totalCoursesCount: validatedSeed.courses.length,
    completionPercentage,
    creditsByField
  }
}

export interface SemesterGPADetail {
  gpa: number | null
  totalPoints: number
  totalCreditsWithGrade: number
  gradedCoursesCount: number
}

export interface GPAMetrics {
  cumulativeGPA: number | null
  totalPoints: number
  totalCreditsWithGrade: number
  gradedCoursesCount: number
  semesterGPAs: Record<number, SemesterGPADetail>
}

export type AcademicStandingStatus = 'pending' | 'good' | 'risk'

/**
 * Evaluates academic standing according to student regulations:
 * Minimum cumulative GPA must never fall below 3.2.
 * For 1st semester students, the 1st period GPA acts as cumulative.
 */
export function getAcademicStanding(cumulativeGPA: number | null): {
  status: AcademicStandingStatus
  minRequired: number
  difference: number | null
} {
  const minRequired = 3.2
  if (cumulativeGPA === null) {
    return { status: 'pending', minRequired, difference: null }
  }
  const difference = Math.round((cumulativeGPA - minRequired) * 100) / 100
  return {
    status: cumulativeGPA >= minRequired ? 'good' : 'risk',
    minRequired,
    difference
  }
}

/**
 * Calculates weighted GPA per semester and cumulative GPA across the curriculum.
 * Only includes completed courses with >0 credits that have an explicit grade (0.0 to 5.0).
 */
export function calculateGPAMetrics(
  userStatusMap: Map<string, CourseStatusType>,
  gradesMap: Map<string, number>,
  plannedPeriodMap?: Map<string, number>
): GPAMetrics {
  let cumulativePoints = 0
  let cumulativeCredits = 0
  let cumulativeGradedCount = 0

  let maxPeriod = validatedSeed.program.total_periods
  if (plannedPeriodMap) {
    for (const p of plannedPeriodMap.values()) {
      const colP = getDisplayColumnPeriod(p)
      if (colP > maxPeriod) maxPeriod = colP
    }
  }

  const semesterGPAs: Record<number, SemesterGPADetail> = {}
  for (let p = 1; p <= maxPeriod; p++) {
    semesterGPAs[p] = {
      gpa: null,
      totalPoints: 0,
      totalCreditsWithGrade: 0,
      gradedCoursesCount: 0
    }
  }

  for (const course of validatedSeed.courses) {
    const isCompleted = userStatusMap.get(course.code) === 'completed'
    const grade = gradesMap.get(course.code)

    if (isCompleted && grade !== undefined && grade !== null && !isNaN(grade)) {
      if (course.credits > 0) {
        const points = grade * course.credits
        cumulativePoints += points
        cumulativeCredits += course.credits
        cumulativeGradedCount++

        const effectivePeriod = getDisplayColumnPeriod(getEffectivePeriod(course, plannedPeriodMap))
        const semDetail = semesterGPAs[effectivePeriod]
        if (semDetail) {
          semDetail.totalPoints += points
          semDetail.totalCreditsWithGrade += course.credits
          semDetail.gradedCoursesCount++
        }
      }
    }
  }

  // Compute GPAs
  for (let p = 1; p <= maxPeriod; p++) {
    const sem = semesterGPAs[p]
    if (sem.totalCreditsWithGrade > 0) {
      sem.gpa = Math.round((sem.totalPoints / sem.totalCreditsWithGrade) * 100) / 100
    }
  }

  const cumulativeGPA = cumulativeCredits > 0
    ? Math.round((cumulativePoints / cumulativeCredits) * 100) / 100
    : null

  return {
    cumulativeGPA,
    totalPoints: cumulativePoints,
    totalCreditsWithGrade: cumulativeCredits,
    gradedCoursesCount: cumulativeGradedCount,
    semesterGPAs
  }
}

