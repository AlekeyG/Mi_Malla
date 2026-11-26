import { describe, it, expect } from 'vitest'
import {
  getCurriculumSeed,
  getAllCourses,
  getCoursesByPeriod,
  calculateCourseState,
  getAffectedDownstreamCourses,
  calculateCurriculumMetrics,
  calculateGPAMetrics,
  getMinPassingGrade,
  isGradePassing,
  getAcademicStanding,
  evaluateCourseMove,
  getSamePeriodPrereqConflicts,
  MAX_CREDITS_PER_SEMESTER,
  MAX_INTERSEMESTRAL_CREDITS
} from '../curriculumEngine'
import type { CourseStatusType } from '../../types/curriculum'

describe('Curriculum Engine & DAG Verification', () => {
  it('should parse seed_data.json correctly with 66 courses and 158 total credits', () => {
    const seed = getCurriculumSeed()
    expect(seed.program.name).toBe('Administración de Empresas')
    expect(seed.program.total_periods).toBe(9)

    const courses = getAllCourses()
    expect(courses.length).toBe(66)

    const totalCredits = courses.reduce((sum, c) => sum + c.credits, 0)
    expect(totalCredits).toBe(158)
  })

  it('should unlock courses without prerequisites by default', () => {
    const userMap = new Map<string, CourseStatusType>()
    const contabilidadState = calculateCourseState('CAD102020104', userMap)
    expect(contabilidadState).toBe('unlocked')
  })

  it('should lock courses with unfulfilled prerequisites', () => {
    const userMap = new Map<string, CourseStatusType>()
    // Costos y Presupuesto requires Contabilidad General
    const costosState = calculateCourseState('CAD102020209', userMap)
    expect(costosState).toBe('locked')
  })

  it('should unlock downstream course when prerequisite is marked completed', () => {
    const userMap = new Map<string, CourseStatusType>()
    userMap.set('CAD102020104', 'completed') // Contabilidad General

    const costosState = calculateCourseState('CAD102020209', userMap)
    expect(costosState).toBe('unlocked')
  })

  it('should perform recursive BFS graph traversal for cascading rollback', () => {
    // Matemática Financiera (Sem 4) -> Análisis Financiero (Sem 5) -> Admin Financiera (Sem 6) -> Finanzas Internacionales (Sem 7)
    const affectedSet = getAffectedDownstreamCourses('CAD102020419')
    expect(affectedSet.has('CAD102020523')).toBe(true) // Análisis Financiero
    expect(affectedSet.has('CAD102020631')).toBe(true) // Admin Financiera
    expect(affectedSet.has('CAD102020736')).toBe(true) // Finanzas Internacionales
  })

  it('should compute area metrics correctly', () => {
    const userMap = new Map<string, CourseStatusType>()
    userMap.set('CAD102020104', 'completed') // 4 credits in Contabilidad y Costos

    const metrics = calculateCurriculumMetrics(userMap)
    expect(metrics.completedCredits).toBe(4)
    expect(metrics.totalCredits).toBe(158)
    expect(metrics.creditsByField['Contabilidad y Costos'].completed).toBe(4)
  })

  it('should order diagnostic courses at the end of each period list', () => {
    const period1Courses = getCoursesByPeriod(1)
    const diagCountP1 = period1Courses.filter(c => c.is_diagnostic).length
    expect(diagCountP1).toBeGreaterThan(0)
    
    // Check that all diagnostic courses appear after non-diagnostic ones
    let seenDiagnostic = false
    for (const course of period1Courses) {
      if (course.is_diagnostic) {
        seenDiagnostic = true
      } else {
        expect(seenDiagnostic).toBe(false)
      }
    }
  })

  it('should calculate weighted semester and cumulative GPA correctly, ignoring ungraded/uncompleted courses', () => {
    const userMap = new Map<string, CourseStatusType>()
    const gradesMap = new Map<string, number>()

    // Contabilidad General (S1, 4 cr): 4.0
    // Fundamentos de Administración (S1, 3 cr): 4.8
    // Total points S1 = (4.0*4) + (4.8*3) = 16 + 14.4 = 30.4 / 7 cr = 4.34
    userMap.set('CAD102020104', 'completed')
    gradesMap.set('CAD102020104', 4.0)

    userMap.set('CAD102020103', 'completed')
    gradesMap.set('CAD102020103', 4.8)

    // A diagnostic 0-credit course with grade 5.0 (should be excluded from weighted GPA)
    userMap.set('DNCAI1002020303', 'completed')
    gradesMap.set('DNCAI1002020303', 5.0)

    const gpa = calculateGPAMetrics(userMap, gradesMap)

    expect(gpa.cumulativeGPA).toBe(4.34)
    expect(gpa.semesterGPAs[1].gpa).toBe(4.34)
    expect(gpa.semesterGPAs[2].gpa).toBeNull()
    expect(gpa.gradedCoursesCount).toBe(2)
  })

  it('should enforce Art. 42 REA minimum passing grades (3.5 for CAI special cases, 3.0 general)', () => {
    const courses = getAllCourses()
    
    // Lengua Extranjera I -> 3.5
    const le1 = courses.find(c => c.code === 'CAI1002020304')!
    expect(getMinPassingGrade(le1)).toBe(3.5)
    expect(isGradePassing(le1, 3.2)).toBe(false)
    expect(isGradePassing(le1, 3.5)).toBe(true)

    // Ciudadanía del Siglo 21 -> 3.5
    const ciud = courses.find(c => c.code === 'CAI1002020303')!
    expect(getMinPassingGrade(ciud)).toBe(3.5)

    // Cátedra Generación Siglo 21 -> 3.5
    const cat = courses.find(c => c.code === 'CAI1002020609')!
    expect(getMinPassingGrade(cat)).toBe(3.5)

    // Contabilidad General (CADI regular) -> 3.0
    const cont = courses.find(c => c.code === 'CAD102020104')!
    expect(getMinPassingGrade(cont)).toBe(3.0)
    expect(isGradePassing(cont, 3.0)).toBe(true)
    expect(isGradePassing(cont, 2.9)).toBe(false)
  })

  it('should evaluate academic standing status against the 3.2 minimum cumulative GPA threshold', () => {
    expect(getAcademicStanding(null).status).toBe('pending')
    
    const goodStanding = getAcademicStanding(3.45)
    expect(goodStanding.status).toBe('good')
    expect(goodStanding.difference).toBe(0.25)

    const exactStanding = getAcademicStanding(3.2)
    expect(exactStanding.status).toBe('good')
    expect(exactStanding.difference).toBe(0)

    const riskStanding = getAcademicStanding(3.15)
    expect(riskStanding.status).toBe('risk')
    expect(riskStanding.difference).toBe(-0.05)
  })

  it('should allow moving a course to the same period as its prerequisite with a warning, and block moving strictly earlier', () => {
    const plannedMap = new Map<string, number>()
    // Costos y Presupuesto (Sem 2) requires Contabilidad General (Sem 1)
    const sameResult = evaluateCourseMove('CAD102020209', 1, plannedMap)
    expect(sameResult.allowed).toBe(true)
    expect(sameResult.severity).toBe('warning')
    expect(sameResult.warnings.some(w => w.includes('Contabilidad General'))).toBe(true)

    const conflictMap = new Map<string, number>([['CAD102020209', 1]])
    const conflicts = getSamePeriodPrereqConflicts(conflictMap)
    expect(conflicts.has('CAD102020209')).toBe(true)
    expect(conflicts.has('CAD102020104')).toBe(true)

    // Moving strictly earlier than prerequisite (Análisis Financiero S5 requires Matemática Financiera S4 -> move to S3) stays blocked
    const earlierResult = evaluateCourseMove('CAD102020523', 3, plannedMap)
    expect(earlierResult.allowed).toBe(false)
    expect(earlierResult.severity).toBe('blocked')
    expect(earlierResult.reason).toContain('Matemática Financiera')
  })

  it('should allow moving a course into a semester that would exceed 18 credits with an academic warning', () => {
    const plannedMap = new Map<string, number>()
    // Sem 2 has 18 official credits. Moving Legislación Comercial (CAD102020101, Sem 1, 3 cr) into Sem 2 does not push anything out -> 21/18 cr
    const result = evaluateCourseMove('CAD102020101', 2, plannedMap)
    expect(result.allowed).toBe(true)
    expect(result.severity).toBe('warning')
    expect(result.targetCreditsAfter).toBe(21)
    expect(result.warnings.some(w => w.includes(`21/${MAX_CREDITS_PER_SEMESTER}`))).toBe(true)
  })

  it('should cascade downstream dependent courses up to 10th+ semester when delaying a prerequisite chain', () => {
    const plannedMap = new Map<string, number>()
    // First make space in Sem 7 by moving an unrelated 3-cr Sem 7 course (CAD102020739 Plan de Negocios) to Sem 10
    const prep = evaluateCourseMove('CAD102020739', 10, plannedMap)
    expect(prep.allowed).toBe(true)
    plannedMap.set('CAD102020739', 10)

    // Move Matemática Financiera (CAD102020419, Sem 4, 3 cr) -> Sem 7.
    // Its chain: Análisis Financiero (S5 -> S8), Admin Financiera (S6 -> S9), Finanzas Internacionales (S7 -> S10)
    const result = evaluateCourseMove('CAD102020419', 7, plannedMap)
    expect(result.allowed).toBe(true)
    expect(result.severity).toBe('cascade')
    expect(result.cascadeShifts.some(s => s.code === 'CAD102020523' && s.toPeriod === 8)).toBe(true)
    expect(result.cascadeShifts.some(s => s.code === 'CAD102020631' && s.toPeriod === 9)).toBe(true)
    expect(result.cascadeShifts.some(s => s.code === 'CAD102020736' && s.toPeriod === 10)).toBe(true)
  })

  it('should attach soft academic warning when advancing capstone or specialization early', () => {
    const plannedMap = new Map<string, number>()
    // Make space in Sem 1 (16 cr -> 16+2=18 cr) for Opción de Grado (CAD102020951, 2 cr, Sem 9, no prereqs)
    const result = evaluateCourseMove('CAD102020951', 1, plannedMap)
    expect(result.allowed).toBe(true)
    expect(result.severity).toBe('warning')
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('should compute semesterGPAs using planned_period including extra semesters (10+)', () => {
    const userMap = new Map<string, CourseStatusType>()
    const gradesMap = new Map<string, number>()
    const plannedMap = new Map<string, number>()

    userMap.set('CAD102020739', 'completed') // Plan de Negocios (3 cr, official S7)
    gradesMap.set('CAD102020739', 4.5)
    plannedMap.set('CAD102020739', 10)

    const gpa = calculateGPAMetrics(userMap, gradesMap, plannedMap)
    expect(gpa.cumulativeGPA).toBe(4.5)
    expect(gpa.semesterGPAs[7].gpa).toBeNull()
    expect(gpa.semesterGPAs[10].gpa).toBe(4.5)
  })

  it('should allow recovering a failed course in intersemestral (1.5) without delaying 2nd semester dependents', () => {
    const plannedMap = new Map<string, number>()
    // Contabilidad General (CAD102020104, 4 cr, S1) -> 1.5 (intersemestral post 1º).
    // Costos y Presupuesto (CAD102020209) is in S2, and 1.5 < 2 so no cascade push!
    const result = evaluateCourseMove('CAD102020104', 1.5, plannedMap)
    expect(result.allowed).toBe(true)
    expect(result.severity).toBe('valid')
    expect(result.cascadeShifts.length).toBe(0)
    expect(result.targetCreditsAfter).toBe(4)
  })

  it('should allow advancing a 2nd semester course into post-1st intersemestral (1.5) when prerequisite is in 1st', () => {
    const plannedMap = new Map<string, number>()
    // Costos y Presupuesto (CAD102020209, 4 cr, S2) requires Contabilidad General (S1). 1 < 1.5 -> allowed!
    const result = evaluateCourseMove('CAD102020209', 1.5, plannedMap)
    expect(result.allowed).toBe(true)
    expect(result.targetCreditsAfter).toBe(4)
  })

  it('should allow exceeding 6-credit limit on intersemestral periods with an academic warning', () => {
    const plannedMap = new Map<string, number>()
    // Contabilidad General (4 cr) already in 1.5
    plannedMap.set('CAD102020104', 1.5)
    // Try adding Microeconomía (CAD102020105, 3 cr) -> 4 + 3 = 7 > 6 cr -> allowed with warning!
    const result = evaluateCourseMove('CAD102020105', 1.5, plannedMap)
    expect(result.allowed).toBe(true)
    expect(result.severity).toBe('warning')
    expect(result.targetCreditsAfter).toBe(7)
    expect(result.warnings.some(w => w.includes(`7/${MAX_INTERSEMESTRAL_CREDITS}`))).toBe(true)
  })
})


