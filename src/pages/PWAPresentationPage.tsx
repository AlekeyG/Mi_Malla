import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  ChevronDown,
  ExternalLink,
  FileText,
  GraduationCap,
  Compass,
  ShieldCheck,
  BookOpen,
  Download
} from 'lucide-react'
import { useCurriculum } from '../context/CurriculumContext'
import { PWAInstallCard } from '../components/PWAInstallCard'

const OFFICIAL_LINKS = [
  {
    title: 'Reglamento Estudiantil (V4)',
    subtitle: 'Documento PDF oficial · Normativa académica general',
    url: 'https://www.ucundinamarca.edu.co/wp-content/uploads/estudiantes/REGLAMENTO%20ESTUDIANTIL%20V4.pdf',
    icon: FileText
  },
  {
    title: 'Reglamento Opciones de Trabajo de Grado',
    subtitle: 'Documento PDF oficial · Plazos, modalidades y requisitos',
    url: 'https://www.ucundinamarca.edu.co/wp-content/uploads/facultades/administrativas/REGLAMENTO-COMITE-OPCIONES-TRABAJO-GRADO.pdf',
    icon: BookOpen
  },
  {
    title: 'Programa Administración de Empresas (UDEC)',
    subtitle: 'Página oficial del programa en el portal institucional',
    url: 'https://www.ucundinamarca.edu.co/programas-pregrado/administracion-de-empresas/',
    icon: GraduationCap
  }
]

export const PWAPresentationPage: React.FC = () => {
  const { setActiveTab } = useCurriculum()
  const [openSection, setOpenSection] = useState<string | null>(null)

  const isInstalled =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true)

  const toggleSection = (key: string) => {
    setOpenSection(prev => (prev === key ? null : key))
  }

  return (
    <div
      style={{
        padding: '24px 16px 40px',
        maxWidth: '760px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px'
      }}
    >
      {/* Presentación principal */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-card)',
          boxShadow: 'var(--shadow-md)',
          padding: '28px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center'
        }}
      >
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            width: '76px',
            height: '76px',
            borderRadius: '20px',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px',
            boxShadow: 'var(--shadow-terracotta)',
            border: '2px solid var(--color-terracotta)',
            marginBottom: '14px'
          }}
        >
          <img
            src="./cundinamarca-icon.png"
            alt="Ícono Mi Malla"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </motion.div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginBottom: '4px'
          }}
        >
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.03em'
            }}
          >
            Mi Malla
          </h1>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '3px 9px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(115, 72, 47, 0.12)',
              color: 'var(--color-terracotta)',
              border: '1px solid rgba(115, 72, 47, 0.3)'
            }}
          >
            Herramienta Libre · v1.2.0
          </span>
        </div>

        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-terracotta)', marginBottom: '18px' }}>
          Administración de Empresas · Referencia Sede Chía
        </p>

        {/* Resumen compacto del pénsum */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '10px',
            width: '100%',
            maxWidth: '500px',
            marginBottom: '20px'
          }}
        >
          <div
            style={{
              padding: '10px 8px',
              backgroundColor: 'var(--bg-card-muted)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-card)'
            }}
          >
            <strong style={{ display: 'block', fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
              9
            </strong>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Semestres
            </span>
          </div>
          <div
            style={{
              padding: '10px 8px',
              backgroundColor: 'var(--bg-card-muted)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-card)'
            }}
          >
            <strong style={{ display: 'block', fontSize: '16px', fontWeight: 800, color: 'var(--color-terracotta)' }}>
              158
            </strong>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Créditos
            </span>
          </div>
          <div
            style={{
              padding: '10px 8px',
              backgroundColor: 'var(--bg-card-muted)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-card)'
            }}
          >
            <strong style={{ display: 'block', fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
              66
            </strong>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Materias
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('malla')}
          style={{
            padding: '12px 26px',
            borderRadius: 'var(--radius-full)',
            border: 'none',
            backgroundColor: 'var(--color-terracotta)',
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: 'var(--shadow-terracotta)'
          }}
        >
          Ir a la Malla
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Enlaces Oficiales */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-card)',
          boxShadow: 'var(--shadow-sm)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        <h2 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 2px' }}>
          Documentos y Enlaces Oficiales
        </h2>

        {OFFICIAL_LINKS.map(link => {
          const Icon = link.icon
          return (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-card)',
                textDecoration: 'none',
                color: 'var(--text-primary)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(115, 72, 47, 0.1)',
                    color: 'var(--color-terracotta)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Icon size={17} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {link.title}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {link.subtitle}
                  </div>
                </div>
              </div>
              <ExternalLink size={15} color="var(--color-steel)" style={{ flexShrink: 0 }} />
            </a>
          )
        })}
      </div>

      {/* Desplegables informativos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* 0. Instalar aplicación */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-card)',
            overflow: 'hidden'
          }}
        >
          <button
            type="button"
            onClick={() => toggleSection('install')}
            aria-expanded={openSection === 'install'}
            style={{
              width: '100%',
              padding: '14px 16px',
              background: 'none',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              textAlign: 'left'
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, flexWrap: 'wrap' }}>
              <Download size={17} color="var(--color-terracotta)" />
              Instalar aplicación
              {isInstalled && (
                <span
                  style={{
                    backgroundColor: '#ECFDF5',
                    color: '#059669',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '1px 7px',
                    borderRadius: '9999px'
                  }}
                >
                  Instalada
                </span>
              )}
            </span>
            <ChevronDown
              size={17}
              color="var(--color-steel)"
              style={{
                transform: openSection === 'install' ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease'
              }}
            />
          </button>

          {openSection === 'install' && (
            <div style={{ padding: '0 12px 12px' }}>
              <PWAInstallCard />
            </div>
          )}
        </div>

        {/* 1. Instrucciones y modos de uso */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-card)',
            overflow: 'hidden'
          }}
        >
          <button
            type="button"
            onClick={() => toggleSection('instructions')}
            aria-expanded={openSection === 'instructions'}
            style={{
              width: '100%',
              padding: '14px 16px',
              background: 'none',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              textAlign: 'left'
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700 }}>
              <Compass size={17} color="var(--color-terracotta)" />
              Instrucciones y modos de uso
            </span>
            <ChevronDown
              size={17}
              color="var(--color-steel)"
              style={{
                transform: openSection === 'instructions' ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease'
              }}
            />
          </button>

          {openSection === 'instructions' && (
            <div
              style={{
                padding: '0 16px 16px',
                fontSize: '12.5px',
                color: 'var(--text-secondary)',
                lineHeight: 1.55,
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <p style={{ margin: 0 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Modo normal:</strong> toca o haz clic en cualquier materia para abrir su detalle, aprobarla, cambiar su estado o registrar su nota.
              </p>
              <p style={{ margin: 0 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Modo ruta:</strong> pulsa el botón <em>Modo Ruta</em> (en celular o PC) o mantén presionada una materia en celular para resaltar sus requisitos previos y lo que desbloquea. Dentro de este modo, toca cualquier materia para fijar o cambiar su ruta y usa el botón rápido para aprobar.
              </p>
              <p style={{ margin: 0 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Modo edición:</strong> pulsa <em>Organizar Malla</em> (o mantén presionada una materia dentro del Modo ruta en celular) para mover materias entre semestres o a intersemestrales (en celular sostén brevemente antes de arrastrar) y aprobar rápido. Las sobrecargas de 18 créditos y los conflictos de requisitos en el mismo semestre se marcan automáticamente.
              </p>
              <p style={{ margin: 0 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Salir rápido:</strong> pulsa <em>Listo</em> en la barra inferior o usa el botón <em>Atrás</em> del celular.
              </p>
            </div>
          )}
        </div>

        {/* 2. Normativa académica y plazos clave */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-card)',
            overflow: 'hidden'
          }}
        >
          <button
            type="button"
            onClick={() => toggleSection('rules')}
            aria-expanded={openSection === 'rules'}
            style={{
              width: '100%',
              padding: '14px 16px',
              background: 'none',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              textAlign: 'left'
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700 }}>
              <BookOpen size={17} color="var(--color-steel)" />
              Normativa académica y plazos clave
            </span>
            <ChevronDown
              size={17}
              color="var(--color-steel)"
              style={{
                transform: openSection === 'rules' ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease'
              }}
            />
          </button>

          {openSection === 'rules' && (
            <ul
              style={{
                margin: 0,
                padding: '0 16px 16px 34px',
                fontSize: '12.5px',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Máximo de créditos (Art. 38):</strong> 18 créditos por período académico.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Nota mínima (Art. 42 REA):</strong> 3.0 general y 3.5 en CAI especiales (Lengua Extranjera, Ciudadanía, Cátedra) y Prácticas.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Permanencia (Art. 44):</strong> promedio ponderado acumulado mínimo de 3.2.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Opción de Grado (Art. 8 Comité):</strong> Pasantía hasta sem. 12 de 5º · Monografía, Emprendimiento u Obra hasta sem. 14 de 5º · Título de Especialización en sem. 1 de 6º.
              </li>
            </ul>
          )}
        </div>

        {/* 3. Políticas, privacidad y aviso legal */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-card)',
            overflow: 'hidden'
          }}
        >
          <button
            type="button"
            onClick={() => toggleSection('legal')}
            aria-expanded={openSection === 'legal'}
            style={{
              width: '100%',
              padding: '14px 16px',
              background: 'none',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              textAlign: 'left'
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700 }}>
              <ShieldCheck size={17} color="var(--color-terracotta)" />
              Políticas, privacidad y aviso legal
            </span>
            <ChevronDown
              size={17}
              color="var(--color-steel)"
              style={{
                transform: openSection === 'legal' ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease'
              }}
            />
          </button>

          {openSection === 'legal' && (
            <div
              style={{
                padding: '0 16px 16px',
                fontSize: '12.5px',
                color: 'var(--text-secondary)',
                lineHeight: 1.55,
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <p style={{ margin: 0 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Proyecto independiente y libre:</strong> <em>Mi Malla</em> es una herramienta estudiantil gratuita creada para compartir libremente. No es una aplicación oficial ni cuenta con afiliación o respaldo de la Universidad de Cundinamarca.
              </p>
              <p style={{ margin: 0 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Enlaces y símbolos:</strong> los accesos directos enlazan únicamente a los portales y documentos públicos originales; esta aplicación no aloja copias ni utiliza escudos o marcas institucionales registradas.
              </p>
              <p style={{ margin: 0 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Privacidad local:</strong> toda tu información, notas y avances se almacenan únicamente en tu dispositivo (IndexedDB), sin cuentas ni servidores externos. Puedes exportar o restaurar tu copia JSON en Ajustes.
              </p>
              <p style={{ margin: 0 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Carácter informativo:</strong> verifica siempre tus créditos, prerrequisitos y plazos vigentes en los canales oficiales de la facultad.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
