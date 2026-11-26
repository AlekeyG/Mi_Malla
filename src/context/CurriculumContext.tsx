import React, { createContext, useState, useMemo } from 'react'

import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  saveCourseStatus,
  getAllUserCourseRecords,
  resetAllProgress,
  saveSetting,
  bulkUpdatePlannedPeriods,
  resetAllPlannedPeriods
} from '../lib/db'
import {
  getAllCourses,
  getCourse,
  calculateCourseState,
  getAffectedDownstreamCourses,
  getAncestorPrerequisites,
  calculateCurriculumMetrics,
  calculateGPAMetrics,
  getEffectivePeriod,
  getDisplayColumnPeriod,
  evaluateCourseMove,
  MAX_PLANNED_PERIOD
} from '../lib/curriculumEngine'
import {
  type Course,
  type CourseStatusType,
  type ComputedCourseState,
  type MoveEvaluationResult,
  type UndoAction
} from '../types/curriculum'

interface CurriculumContextType {
  isHydrating: boolean
  courses: Course[]
  userStatusMap: Map<string, CourseStatusType>
  computedStateMap: Map<string, ComputedCourseState>
  customNamesMap: Map<string, string>
  gradesMap: Map<string, number>
  plannedPeriodMap: Map<string, number>
  visiblePeriods: number[]
  hasCustomPlan: boolean
  selectedPeriod: number
  setSelectedPeriod: (period: number) => void
  activeTab: 'malla' | 'analytics' | 'settings' | 'about'
  setActiveTab: (tab: 'malla' | 'analytics' | 'settings' | 'about') => void
  theme: 'light' | 'dark'
  toggleTheme: () => void
  inspectedCourseCode: string | null
  setInspectedCourseCode: (code: string | null) => void

  // Organize / Drag & Drop Mode
  isOrganizeMode: boolean
  setOrganizeMode: (active: boolean) => void
  toggleOrganizeMode: () => void
  addExtraPeriod: () => number | null
  moveCourseToPeriod: (code: string, targetPeriod: number) => Promise<MoveEvaluationResult>
  resetPlannedPeriods: () => Promise<void>

  // Diagnostics Visibility State
  hideDiagnosticsInMalla: boolean
  toggleHideDiagnosticsInMalla: () => Promise<void>

  // Chain Glow Focus State
  focusedCourseCode: string | null
  setFocusedCourseCode: (code: string | null) => void
  showCourseChainInMalla: (code: string) => void
  clearCourseChainInMalla: () => void
  ancestorPrereqCodes: Set<string>
  descendantUnlockCodes: Set<string>
  
  // Actions
  toggleCourseStatus: (code: string) => Promise<void>
  setCourseStatus: (code: string, status: CourseStatusType) => Promise<void>
  setCourseExtras: (code: string, extras: { grade?: number; custom_name?: string }) => Promise<void>
  completeSemester: (periodNumber: number) => Promise<void>
  uncompleteSemester: (periodNumber: number) => Promise<void>
  resetProgress: () => Promise<void>
  
  // Simulation Mode
  isSimulationMode: boolean
  toggleSimulationMode: () => void
  
  // Metrics
  metrics: ReturnType<typeof calculateCurriculumMetrics>
  gpaMetrics: ReturnType<typeof calculateGPAMetrics>
  
  // Undo Toast State
  undoState: UndoAction | null
  undoLastAction: () => Promise<void>
  clearUndo: () => void
  modeToastMessage: string | null
  showModeToast: (msg: string) => void
  clearModeToast: () => void
}

const CurriculumContext = createContext<CurriculumContextType | null>(null)

export const CurriculumProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<number>(1)
  const [activeTab, setActiveTabState] = useState<'malla' | 'analytics' | 'settings' | 'about'>('malla')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [inspectedCourseCode, setInspectedCourseCodeState] = useState<string | null>(null)
  const [focusedCourseCode, setFocusedCourseCode] = useState<string | null>(null)
  const [isSimulationMode, setIsSimulationMode] = useState<boolean>(false)
  const [simulatedStatuses, setSimulatedStatuses] = useState<Map<string, CourseStatusType>>(new Map())
  const [simulatedPlannedPeriods, setSimulatedPlannedPeriods] = useState<Map<string, number>>(new Map())
  const [isOrganizeMode, setIsOrganizeMode] = useState<boolean>(false)
  const [manualExtraPeriods, setManualExtraPeriods] = useState<number>(0)
  const [undoState, setUndoState] = useState<UndoAction | null>(null)
  const [modeToastMessage, setModeToastMessage] = useState<string | null>(null)

  const showModeToast = React.useCallback((msg: string) => setModeToastMessage(msg), [])
  const clearModeToast = React.useCallback(() => setModeToastMessage(null), [])

  // Mobile PWA Back Button & History Navigation Handlers
  const setActiveTab = (tab: 'malla' | 'analytics' | 'settings' | 'about') => {
    if (tab !== activeTab) {
      if (typeof window !== 'undefined' && window.history) {
        window.history.pushState({ tab }, '')
      }
      setActiveTabState(tab)
    }
  }

  const inspectedCourseCodeRef = React.useRef<string | null>(null)
  const focusedCourseCodeRef = React.useRef<string | null>(null)
  const isOrganizeModeRef = React.useRef<boolean>(false)
  const ignoreNextPopStateRef = React.useRef<boolean>(false)

  React.useEffect(() => {
    inspectedCourseCodeRef.current = inspectedCourseCode
  }, [inspectedCourseCode])

  React.useEffect(() => {
    focusedCourseCodeRef.current = focusedCourseCode
  }, [focusedCourseCode])

  React.useEffect(() => {
    isOrganizeModeRef.current = isOrganizeMode
  }, [isOrganizeMode])

  const setInspectedCourseCode = (code: string | null) => {
    if (code === null) {
      focusedCourseCodeRef.current = null
      setFocusedCourseCode(null)
    }
    if (typeof window !== 'undefined' && window.history) {
      if (code !== null && inspectedCourseCodeRef.current === null) {
        window.history.pushState({ modal: 'drawer', code, tab: activeTab }, '')
      } else if (code === null && inspectedCourseCodeRef.current !== null) {
        if (window.history.state && window.history.state.modal === 'drawer') {
          ignoreNextPopStateRef.current = true
          window.history.back()
          inspectedCourseCodeRef.current = null
          setInspectedCourseCodeState(null)
          return
        }
      }
    }
    inspectedCourseCodeRef.current = code
    setInspectedCourseCodeState(code)
  }

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.history) return

    // Ensure initial entry has state
    if (window.history.state === null) {
      window.history.replaceState({ tab: 'malla' }, '')
    }

    const handlePopState = (e: PopStateEvent) => {
      if (ignoreNextPopStateRef.current) {
        ignoreNextPopStateRef.current = false
        return
      }

      // 1. Intercept Back button gesture when Course Drawer is open
      if (inspectedCourseCodeRef.current !== null) {
        inspectedCourseCodeRef.current = null
        setInspectedCourseCodeState(null)
        focusedCourseCodeRef.current = null
        setFocusedCourseCode(null)
        return
      }

      // 2. Intercept Back button gesture when Course Chain Focus is active
      if (focusedCourseCodeRef.current !== null) {
        focusedCourseCodeRef.current = null
        setFocusedCourseCode(null)
        return
      }

      // 3. Intercept Back button gesture when Organize Mode is active
      if (isOrganizeModeRef.current) {
        isOrganizeModeRef.current = false
        setIsOrganizeMode(false)
        return
      }

      // 4. Intercept Back button gesture for Tab Navigation
      if (e.state && e.state.tab) {
        setActiveTabState(e.state.tab)
      } else {
        setActiveTabState('malla')
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Live Query from Dexie.js (Reactive Local-First)
  const liveRecords = useLiveQuery(async () => {
    return await getAllUserCourseRecords()
  }, [])

  const isHydrating = liveRecords === undefined

  const allCourses = useMemo(() => getAllCourses(), [])

  // Build real userStatusMap, customNamesMap, gradesMap & plannedPeriodMap from Dexie
  const { userStatusMap, customNamesMap, gradesMap, plannedPeriodMap } = useMemo(() => {
    const statusMap = new Map<string, CourseStatusType>()
    const namesMap = new Map<string, string>()
    const gMap = new Map<string, number>()
    const pMap = new Map<string, number>()

    if (isSimulationMode) {
      // In simulation mode, preserve custom names from liveRecords and use simulated clones
      if (liveRecords) {
        for (const rec of liveRecords) {
          if (rec.custom_name) namesMap.set(rec.course_code, rec.custom_name)
        }
      }
      return {
        userStatusMap: new Map(simulatedStatuses),
        customNamesMap: namesMap,
        gradesMap: gMap,
        plannedPeriodMap: new Map(simulatedPlannedPeriods)
      }
    }

    if (liveRecords) {
      for (const rec of liveRecords) {
        statusMap.set(rec.course_code, rec.status)
        if (rec.custom_name) namesMap.set(rec.course_code, rec.custom_name)
        if (rec.grade !== undefined) gMap.set(rec.course_code, rec.grade)
        if (rec.planned_period !== undefined) pMap.set(rec.course_code, rec.planned_period)
      }
    }

    return { userStatusMap: statusMap, customNamesMap: namesMap, gradesMap: gMap, plannedPeriodMap: pMap }
  }, [liveRecords, isSimulationMode, simulatedStatuses, simulatedPlannedPeriods])

  // Visible periods (1..9 plus any dynamic 10+ semesters)
  const visiblePeriods = useMemo(() => {
    let maxPeriod = 9 + manualExtraPeriods
    for (const p of plannedPeriodMap.values()) {
      const colP = getDisplayColumnPeriod(p)
      if (colP > maxPeriod) maxPeriod = colP
    }
    const clampedMax = Math.min(MAX_PLANNED_PERIOD, Math.max(9, maxPeriod))
    return Array.from({ length: clampedMax }, (_, idx) => idx + 1)
  }, [plannedPeriodMap, manualExtraPeriods])

  const hasCustomPlan = plannedPeriodMap.size > 0

  // Computed state map (locked, unlocked, in_progress, completed, failed)
  const computedStateMap = useMemo(() => {
    const map = new Map<string, ComputedCourseState>()
    for (const course of allCourses) {
      map.set(course.code, calculateCourseState(course.code, userStatusMap))
    }
    return map
  }, [allCourses, userStatusMap])

  const showCourseChainInMalla = (code: string) => {
    inspectedCourseCodeRef.current = null
    setInspectedCourseCodeState(null)
    if (typeof window !== 'undefined' && window.history) {
      if (window.history.state && window.history.state.modal === 'drawer') {
        window.history.replaceState({ modal: 'chain', code, tab: activeTab }, '')
      } else {
        window.history.pushState({ modal: 'chain', code, tab: activeTab }, '')
      }
    }
    focusedCourseCodeRef.current = code
    setFocusedCourseCode(code)
  }

  const clearCourseChainInMalla = () => {
    focusedCourseCodeRef.current = null
    setFocusedCourseCode(null)
    if (typeof window !== 'undefined' && window.history) {
      if (window.history.state && window.history.state.modal === 'chain') {
        ignoreNextPopStateRef.current = true
        window.history.back()
      }
    }
  }

  // Diagnostics visibility state (instant in-RAM state hydrated from IndexedDB)
  const [hideDiagnosticsInMalla, setHideDiagnosticsInMalla] = useState<boolean>(false)

  React.useEffect(() => {
    db.user_settings
      .get('hideDiagnosticsInMalla')
      .then(rec => {
        if (rec) {
          setHideDiagnosticsInMalla(rec.value === true || rec.value === 'true')
        }
      })
      .catch(() => {})
  }, [])

  const toggleHideDiagnosticsInMalla = async () => {
    setHideDiagnosticsInMalla(prev => {
      const next = !prev
      saveSetting('hideDiagnosticsInMalla', next).catch(() => {})
      return next
    })
  }

  // Metrics
  const metrics = useMemo(() => calculateCurriculumMetrics(userStatusMap), [userStatusMap])
  const gpaMetrics = useMemo(
    () => calculateGPAMetrics(userStatusMap, gradesMap, plannedPeriodMap),
    [userStatusMap, gradesMap, plannedPeriodMap]
  )

  // Chain Glow Ancestors & Descendants calculation
  const { ancestorPrereqCodes, descendantUnlockCodes } = useMemo(() => {
    if (!focusedCourseCode) {
      return { ancestorPrereqCodes: new Set<string>(), descendantUnlockCodes: new Set<string>() }
    }
    return {
      ancestorPrereqCodes: getAncestorPrerequisites(focusedCourseCode),
      descendantUnlockCodes: getAffectedDownstreamCourses(focusedCourseCode)
    }
  }, [focusedCourseCode])

  // Theme toggle
  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(nextTheme)
    document.documentElement.setAttribute('data-theme', nextTheme)
  }

  // Toggle Course Status Action (with Cascading Rollback)
  const setCourseStatus = async (code: string, newStatus: CourseStatusType) => {
    const previousStatus = userStatusMap.get(code) || 'pending'
    setUndoState({ type: 'status', code, previousStatus })

    if (isSimulationMode) {
      const nextMap = new Map(simulatedStatuses)
      if (newStatus === 'pending') {
        nextMap.delete(code)
        // Cascade rollback
        const affected = getAffectedDownstreamCourses(code)
        for (const affCode of affected) {
          nextMap.delete(affCode)
        }
      } else {
        nextMap.set(code, newStatus)
      }
      setSimulatedStatuses(nextMap)
      return
    }

    if (newStatus === 'pending' || newStatus === 'failed') {
      // Cascading rollback: find all downstream courses and reset them
      const affected = getAffectedDownstreamCourses(code)
      await db.transaction('rw', db.user_course_status, async () => {
        await saveCourseStatus(code, newStatus)
        for (const affCode of affected) {
          await saveCourseStatus(affCode, 'pending')
        }
      })
    } else {
      await saveCourseStatus(code, newStatus)
    }
  }

  const toggleCourseStatus = async (code: string) => {
    const current = computedStateMap.get(code)
    if (current === 'completed') {
      await setCourseStatus(code, 'pending')
    } else if (current === 'in_progress' || current === 'unlocked' || current === 'failed') {
      await setCourseStatus(code, 'completed')
    }
  }

  const setCourseExtras = async (code: string, extras: { grade?: number; custom_name?: string }) => {
    const currentStatus = userStatusMap.get(code) || 'pending'
    if (!isSimulationMode) {
      await saveCourseStatus(code, currentStatus, extras)
    }
  }

  const setOrganizeMode = (active: boolean) => {
    if (active === isOrganizeModeRef.current) return
    isOrganizeModeRef.current = active
    setIsOrganizeMode(active)
    if (active) {
      focusedCourseCodeRef.current = null
      setFocusedCourseCode(null)
      if (typeof window !== 'undefined' && window.history) {
        if (window.history.state && window.history.state.modal === 'chain') {
          window.history.replaceState({ modal: 'organize', tab: activeTab }, '')
        } else {
          window.history.pushState({ modal: 'organize', tab: activeTab }, '')
        }
      }
    } else if (typeof window !== 'undefined' && window.history) {
      if (window.history.state && window.history.state.modal === 'organize') {
        ignoreNextPopStateRef.current = true
        window.history.back()
      }
    }
  }

  const toggleOrganizeMode = () => {
    setOrganizeMode(!isOrganizeModeRef.current)
  }

  const addExtraPeriod = (): number | null => {
    const currentMax = visiblePeriods[visiblePeriods.length - 1] ?? 9
    if (currentMax >= MAX_PLANNED_PERIOD) return null
    const nextPeriod = currentMax + 1
    setManualExtraPeriods(nextPeriod - 9)
    return nextPeriod
  }

  const moveCourseToPeriod = async (code: string, targetPeriod: number): Promise<MoveEvaluationResult> => {
    const evaluation = evaluateCourseMove(code, targetPeriod, plannedPeriodMap)
    if (!evaluation.allowed || targetPeriod === evaluation.fromPeriod) {
      return evaluation
    }

    const previousPeriods: Array<{ code: string; previousPeriod: number | undefined }> = [
      { code, previousPeriod: plannedPeriodMap.get(code) }
    ]

    const primaryCourse = getCourse(code)
    const updates: Array<{ code: string; planned_period?: number }> = [
      {
        code,
        planned_period: primaryCourse && targetPeriod === primaryCourse.period ? undefined : targetPeriod
      }
    ]

    for (const shift of evaluation.cascadeShifts) {
      previousPeriods.push({ code: shift.code, previousPeriod: plannedPeriodMap.get(shift.code) })
      const shiftCourse = getCourse(shift.code)
      updates.push({
        code: shift.code,
        planned_period: shiftCourse && shift.toPeriod === shiftCourse.period ? undefined : shift.toPeriod
      })
    }

    setUndoState({
      type: 'move',
      courseCode: code,
      targetPeriod,
      previousPeriods,
      movedCount: updates.length
    })

    if (isSimulationMode) {
      const nextMap = new Map(simulatedPlannedPeriods)
      for (const u of updates) {
        if (u.planned_period === undefined) {
          nextMap.delete(u.code)
        } else {
          nextMap.set(u.code, u.planned_period)
        }
      }
      setSimulatedPlannedPeriods(nextMap)
      return evaluation
    }

    await bulkUpdatePlannedPeriods(updates)
    return evaluation
  }

  const resetPlannedPeriods = async () => {
    if (isSimulationMode) {
      setSimulatedPlannedPeriods(new Map())
    } else {
      await resetAllPlannedPeriods()
    }
    setManualExtraPeriods(0)
    if (selectedPeriod > 9) {
      setSelectedPeriod(1)
    }
  }

  const completeSemester = async (periodNumber: number) => {
    const periodCourses = allCourses.filter(
      c =>
        getDisplayColumnPeriod(getEffectivePeriod(c, plannedPeriodMap)) === periodNumber &&
        computedStateMap.get(c.code) !== 'locked'
    )
    if (isSimulationMode) {
      const nextMap = new Map(simulatedStatuses)
      for (const c of periodCourses) {
        nextMap.set(c.code, 'completed')
      }
      setSimulatedStatuses(nextMap)
      return
    }

    await db.transaction('rw', db.user_course_status, async () => {
      for (const c of periodCourses) {
        await saveCourseStatus(c.code, 'completed')
      }
    })
  }

  const uncompleteSemester = async (periodNumber: number) => {
    const periodCourses = allCourses.filter(
      c =>
        getDisplayColumnPeriod(getEffectivePeriod(c, plannedPeriodMap)) === periodNumber &&
        userStatusMap.get(c.code) === 'completed'
    )
    if (periodCourses.length === 0) return

    const codesToReset = new Set<string>()
    for (const c of periodCourses) {
      codesToReset.add(c.code)
      const affected = getAffectedDownstreamCourses(c.code)
      for (const affCode of affected) {
        codesToReset.add(affCode)
      }
    }

    if (isSimulationMode) {
      const nextMap = new Map(simulatedStatuses)
      for (const code of codesToReset) {
        nextMap.delete(code)
      }
      setSimulatedStatuses(nextMap)
      return
    }

    await db.transaction('rw', db.user_course_status, async () => {
      for (const code of codesToReset) {
        await saveCourseStatus(code, 'pending')
      }
    })
  }

  const resetProgress = async () => {
    if (isSimulationMode) {
      setSimulatedStatuses(new Map())
      setSimulatedPlannedPeriods(new Map())
      setManualExtraPeriods(0)
      return
    }
    await resetAllProgress()
    setManualExtraPeriods(0)
  }

  const toggleSimulationMode = () => {
    if (!isSimulationMode) {
      // Start simulation with clone of current state & planned periods
      setSimulatedStatuses(new Map(userStatusMap))
      setSimulatedPlannedPeriods(new Map(plannedPeriodMap))
    }
    setIsSimulationMode(!isSimulationMode)
  }

  const undoLastAction = async () => {
    if (!undoState) return
    const action = undoState
    setUndoState(null)

    if (action.type === 'status') {
      await setCourseStatus(action.code, action.previousStatus)
      setUndoState(null)
      return
    }

    if (isSimulationMode) {
      const nextMap = new Map(simulatedPlannedPeriods)
      for (const prev of action.previousPeriods) {
        if (prev.previousPeriod === undefined) {
          nextMap.delete(prev.code)
        } else {
          nextMap.set(prev.code, prev.previousPeriod)
        }
      }
      setSimulatedPlannedPeriods(nextMap)
      return
    }

    await bulkUpdatePlannedPeriods(
      action.previousPeriods.map(p => ({ code: p.code, planned_period: p.previousPeriod }))
    )
  }

  const clearUndo = () => setUndoState(null)

  return (
    <CurriculumContext.Provider
      value={{
        isHydrating,
        courses: allCourses,
        userStatusMap,
        computedStateMap,
        customNamesMap,
        gradesMap,
        plannedPeriodMap,
        visiblePeriods,
        hasCustomPlan,
        selectedPeriod,
        setSelectedPeriod,
        activeTab,
        setActiveTab,
        theme,
        toggleTheme,
        inspectedCourseCode,
        setInspectedCourseCode,
        isOrganizeMode,
        setOrganizeMode,
        toggleOrganizeMode,
        addExtraPeriod,
        moveCourseToPeriod,
        resetPlannedPeriods,
        hideDiagnosticsInMalla,
        toggleHideDiagnosticsInMalla,
        focusedCourseCode,
        setFocusedCourseCode,
        showCourseChainInMalla,
        clearCourseChainInMalla,
        ancestorPrereqCodes,
        descendantUnlockCodes,
        toggleCourseStatus,
        setCourseStatus,
        setCourseExtras,
        completeSemester,
        uncompleteSemester,
        resetProgress,
        isSimulationMode,
        toggleSimulationMode,
        metrics,
        gpaMetrics,
        undoState,
        undoLastAction,
        clearUndo,
        modeToastMessage,
        showModeToast,
        clearModeToast
      }}
    >
      {children}
    </CurriculumContext.Provider>
  )
}

export { CurriculumContext }
export { useCurriculum } from '../hooks/useCurriculum'

