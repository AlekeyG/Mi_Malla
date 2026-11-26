import { z } from 'zod'

// ==========================================================================
// ZOD SCHEMAS & TYPES FOR SEED CURRICULUM DATA
// ==========================================================================

export const ZCategory = z.enum([
  'core',
  'diagnostic',
  'general_education',
  'elective',
  'specialization',
  'capstone'
])
export type CourseCategory = z.infer<typeof ZCategory>

export const ZCourse = z.object({
  period: z.number().int().min(1).max(9),
  code: z.string().min(1),
  name: z.string().min(1),
  ht: z.number().int().min(0),
  hp: z.number().int().min(0),
  htp: z.number().int().min(0),
  credits: z.number().int().min(0),
  weighting: z.number().int().min(0),
  is_diagnostic: z.boolean(),
  is_elective: z.boolean(),
  category: ZCategory,
  learning_field: z.string().nullable(),
  elective_slot: z.string().optional(),
  prereqs: z.array(z.string())
})
export type Course = z.infer<typeof ZCourse>

export const ZProgram = z.object({
  name: z.string(),
  institution: z.string(),
  campus: z.string(),
  modality: z.string(),
  total_periods: z.number().int().positive()
})
export type Program = z.infer<typeof ZProgram>

export const ZCurriculumSeed = z.object({
  program: ZProgram,
  learning_fields: z.array(z.string()),
  courses: z.array(ZCourse)
})
export type CurriculumSeed = z.infer<typeof ZCurriculumSeed>

// ==========================================================================
// ZOD SCHEMAS & TYPES FOR USER PROGRESS & PERSISTENCE
// ==========================================================================

export const ZCourseStatusType = z.enum([
  'pending',
  'in_progress',
  'completed',
  'failed'
])
export type CourseStatusType = z.infer<typeof ZCourseStatusType>

export const ZComputedState = z.enum([
  'locked',
  'unlocked',
  'in_progress',
  'completed',
  'failed'
])
export type ComputedCourseState = z.infer<typeof ZComputedState>

export const ZUserCourseRecord = z.object({
  course_code: z.string(),
  status: ZCourseStatusType,
  grade: z.number().min(0).max(5).optional(),
  term_taken: z.string().optional(),
  custom_name: z.string().optional(),
  planned_period: z
    .number()
    .min(1)
    .max(16.5)
    .refine(v => Number.isInteger(v * 2), {
      message: 'El período debe ser entero o intersemestral (.5)'
    })
    .optional(),
  updated_at: z.number().int()
})
export type UserCourseRecord = z.infer<typeof ZUserCourseRecord>

// ==========================================================================
// COURSE MOVE / REORGANIZATION & UNDO TYPES
// ==========================================================================

export type MoveSeverity = 'valid' | 'cascade' | 'warning' | 'blocked'

export interface CascadeShift {
  code: string
  name: string
  credits: number
  fromPeriod: number
  toPeriod: number
}

export interface MoveEvaluationResult {
  allowed: boolean
  severity: MoveSeverity
  courseCode: string
  fromPeriod: number
  targetPeriod: number
  reason?: string
  warnings: string[]
  cascadeShifts: CascadeShift[]
  targetCreditsAfter: number
  overflowPeriodsAfter: Array<{ period: number; credits: number }>
}

export type UndoAction =
  | {
      type: 'status'
      code: string
      previousStatus: CourseStatusType
    }
  | {
      type: 'move'
      courseCode: string
      targetPeriod: number
      previousPeriods: Array<{ code: string; previousPeriod: number | undefined }>
      movedCount: number
    }

export const ZUserProgressImport = z.object({
  version: z.string(),
  exported_at: z.number().int(),
  program_name: z.string(),
  records: z.array(ZUserCourseRecord),
  unlocked_achievements: z.array(z.string()).optional()
})
export type UserProgressImport = z.infer<typeof ZUserProgressImport>
