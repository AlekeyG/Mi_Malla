import React from 'react'
import { Home, Map, BarChart3, Settings, ArrowLeftRight, GitBranch, Check } from 'lucide-react'
import { useCurriculum } from '../context/CurriculumContext'

export const BottomNav: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    isOrganizeMode,
    setOrganizeMode,
    isRouteMode,
    toggleRouteMode,
    focusedCourseCode,
    clearCourseChainInMalla
  } = useCurriculum()

  const isMobileRouteActive =
    focusedCourseCode !== null &&
    typeof window !== 'undefined' &&
    !window.matchMedia('(hover: hover)').matches

  const showRouteNav = !isOrganizeMode && (isRouteMode || isMobileRouteActive)

  if (isOrganizeMode || showRouteNav) {
    const accent = isOrganizeMode ? 'var(--color-terracotta)' : 'var(--color-steel)'
    const ModeIcon = isOrganizeMode ? ArrowLeftRight : GitBranch
    const label = isOrganizeMode ? 'Modo edición' : 'Modo ruta'
    const hint = isOrganizeMode
      ? '· Arrastra cualquier materia'
      : '· Toca una materia para ver requisitos'
    const navAria = isOrganizeMode ? 'Indicador de modo edición' : 'Indicador de modo ruta'
    const doneAria = isOrganizeMode ? 'Salir del modo edición' : 'Salir del modo ruta'
    const handleDone = () => {
      if (isOrganizeMode) {
        setOrganizeMode(false)
      } else if (isRouteMode) {
        toggleRouteMode()
      } else {
        clearCourseChainInMalla()
      }
    }

    return (
      <nav
        className="glass-panel"
        aria-label={navAria}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          paddingTop: '10px',
          paddingLeft: '16px',
          paddingRight: '16px',
          paddingBottom: 'max(14px, env(safe-area-inset-bottom, 14px))',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          borderTop: `2px solid ${accent}`
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '800px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <ModeIcon size={17} color={accent} style={{ flexShrink: 0 }} />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {label}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                {hint}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDone}
            aria-label={doneAria}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 14px',
              backgroundColor: accent,
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <Check size={14} />
            Listo
          </button>
        </div>
      </nav>
    )
  }

  return (
    <nav
      className="glass-panel"
      aria-label="Navegación principal de la aplicación"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        paddingTop: '10px',
        paddingLeft: '16px',
        paddingRight: '16px',
        paddingBottom: 'max(14px, env(safe-area-inset-bottom, 14px))',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        borderTop: '1px solid var(--border-card)'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '800px',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center'
        }}
      >
        {/* Item 1: Presentación PWA / Inicio */}
        <button
          onClick={() => setActiveTab('about')}
          aria-label="Ir a la sección de Inicio"
          aria-current={activeTab === 'about' ? 'page' : undefined}
          title="Ver presentación completa de Mi Malla PWA"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: activeTab === 'about' ? 'var(--color-terracotta)' : 'var(--color-steel)',
            fontWeight: activeTab === 'about' ? 700 : 500
          }}
        >
          <Home size={19} />
          <span style={{ fontSize: '11px' }}>Inicio</span>
        </button>

        {/* Item 2: Malla */}
        <button
          onClick={() => setActiveTab('malla')}
          aria-label="Ir a la Malla Curricular"
          aria-current={activeTab === 'malla' ? 'page' : undefined}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: activeTab === 'malla' ? 'var(--color-terracotta)' : 'var(--color-steel)',
            fontWeight: activeTab === 'malla' ? 700 : 500
          }}
        >
          <Map size={19} />
          <span style={{ fontSize: '11px' }}>Malla</span>
        </button>

        {/* Item 3: Métricas */}
        <button
          onClick={() => setActiveTab('analytics')}
          aria-label="Ir a Métricas y Analíticas"
          aria-current={activeTab === 'analytics' ? 'page' : undefined}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: activeTab === 'analytics' ? 'var(--color-terracotta)' : 'var(--color-steel)',
            fontWeight: activeTab === 'analytics' ? 700 : 500
          }}
        >
          <BarChart3 size={19} />
          <span style={{ fontSize: '11px' }}>Métricas</span>
        </button>

        {/* Item 5: Ajustes */}
        <button
          onClick={() => setActiveTab('settings')}
          aria-label="Ir a Configuración y Ajustes"
          aria-current={activeTab === 'settings' ? 'page' : undefined}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: activeTab === 'settings' ? 'var(--color-terracotta)' : 'var(--color-steel)',
            fontWeight: activeTab === 'settings' ? 700 : 500
          }}
        >
          <Settings size={19} />
          <span style={{ fontSize: '11px' }}>Ajustes</span>
        </button>
      </div>
    </nav>

  )
}
