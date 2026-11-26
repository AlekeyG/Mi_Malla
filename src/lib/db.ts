import Dexie, { type Table } from 'dexie'
import type { UserCourseRecord, CourseStatusType, UserProgressImport } from '../types/curriculum'

export interface AchievementRecord {
  achievement_id: string
  unlocked_at: number
}

export interface UserSettingRecord {
  key: string
  value: string | number | boolean
}

export class MiMallaDatabase extends Dexie {
  user_course_status!: Table<UserCourseRecord, string>
  user_achievements!: Table<AchievementRecord, string>
  user_settings!: Table<UserSettingRecord, string>

  constructor() {
    super('MiMallaDB')
    
    this.version(1).stores({
      user_course_status: '&course_code, status, updated_at',
      user_achievements: '&achievement_id, unlocked_at',
      user_settings: '&key'
    })
  }
}

export const db = new MiMallaDatabase()

// ==========================================================================
// DEXIE HELPER FUNCTIONS
// ==========================================================================

export async function getCourseRecord(courseCode: string): Promise<UserCourseRecord | undefined> {
  return await db.user_course_status.get(courseCode)
}

export async function getAllUserCourseRecords(): Promise<UserCourseRecord[]> {
  return await db.user_course_status.toArray()
}

export async function saveCourseStatus(
  courseCode: string,
  status: CourseStatusType,
  extras?: { grade?: number; custom_name?: string; term_taken?: string; planned_period?: number }
): Promise<void> {
  const existing = await db.user_course_status.get(courseCode)
  const hasPlannedPeriod = extras !== undefined && 'planned_period' in extras
  const record: UserCourseRecord = {
    course_code: courseCode,
    status,
    grade: extras?.grade ?? existing?.grade,
    custom_name: extras?.custom_name ?? existing?.custom_name,
    term_taken: extras?.term_taken ?? existing?.term_taken,
    planned_period: hasPlannedPeriod ? extras?.planned_period : existing?.planned_period,
    updated_at: Date.now()
  }
  await db.user_course_status.put(record)
}

export async function bulkUpdatePlannedPeriods(
  updates: Array<{ code: string; planned_period?: number }>
): Promise<void> {
  await db.transaction('rw', db.user_course_status, async () => {
    const now = Date.now()
    for (const { code, planned_period } of updates) {
      const existing = await db.user_course_status.get(code)
      const record: UserCourseRecord = {
        course_code: code,
        status: existing?.status ?? 'pending',
        grade: existing?.grade,
        custom_name: existing?.custom_name,
        term_taken: existing?.term_taken,
        planned_period,
        updated_at: now
      }
      await db.user_course_status.put(record)
    }
  })
}

export async function resetAllPlannedPeriods(): Promise<void> {
  await db.transaction('rw', db.user_course_status, async () => {
    const all = await db.user_course_status.toArray()
    const now = Date.now()
    for (const rec of all) {
      if (rec.planned_period !== undefined) {
        const updated: UserCourseRecord = {
          ...rec,
          planned_period: undefined,
          updated_at: now
        }
        await db.user_course_status.put(updated)
      }
    }
  })
}

export async function bulkSaveCourseStatuses(records: UserCourseRecord[]): Promise<void> {
  await db.transaction('rw', db.user_course_status, async () => {
    for (const rec of records) {
      await db.user_course_status.put(rec)
    }
  })
}

export async function resetAllProgress(): Promise<void> {
  await db.transaction('rw', [db.user_course_status, db.user_achievements], async () => {
    await db.user_course_status.clear()
    await db.user_achievements.clear()
  })
}

export async function exportProgressJSON(programName: string): Promise<UserProgressImport> {
  const records = await db.user_course_status.toArray()
  const achievements = await db.user_achievements.toArray()

  return {
    version: '1.0',
    exported_at: Date.now(),
    program_name: programName,
    records,
    unlocked_achievements: achievements.map(a => a.achievement_id)
  }
}

export async function getSetting<T = string | number | boolean>(key: string): Promise<T | undefined> {
  const rec = await db.user_settings.get(key)
  return rec?.value as T | undefined
}

export async function saveSetting(key: string, value: string | number | boolean): Promise<void> {
  await db.user_settings.put({ key, value })
}

