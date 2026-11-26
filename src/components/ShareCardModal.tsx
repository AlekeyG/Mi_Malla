import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Share2 } from 'lucide-react'
import { useCurriculum } from '../context/CurriculumContext'

interface ShareCardModalProps {
  isOpen: boolean
  onClose: () => void
}

export const ShareCardModal: React.FC<ShareCardModalProps> = ({ isOpen, onClose }) => {
  const { metrics, gpaMetrics } = useCurriculum()

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Mi Malla — Progreso Académico',
          text: `Llevo ${metrics.completedCredits} de ${metrics.totalCredits} créditos (${Math.round(metrics.completionPercentage)}%) en Administración de Empresas · UDEC. 🎓`,
          url: window.location.href
        })
      } catch {
        // user cancelled share
      }
    } else {
      alert('¡Progreso copiado! Comparte tu avance universitario con tus amigos.')
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(6px)',
            padding: '20px'
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              padding: '28px 24px',
              boxShadow: 'var(--shadow-lg)',
              border: '2px solid var(--border-card)',
              position: 'relative'
            }}
          >
            <button
              onClick={onClose}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)'
              }}
            >
              <X size={20} />
            </button>

            {/* Character Card Main Design */}
            <div
              id="student-character-card"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderRadius: 'var(--radius-md)',
                padding: '24px',
                border: '2px solid var(--color-terracotta)',
                boxShadow: 'var(--shadow-terracotta)',
                marginBottom: '20px'
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img src="./logo.svg" alt="Logo" style={{ width: '36px', height: '36px' }} />
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>Mi Malla</h3>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Ficha de Estudiante</span>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--bg-card-muted)',
                    color: 'var(--color-terracotta)'
                  }}
                >
                  {Math.round(metrics.completionPercentage)}%
                </span>
              </div>

              {/* Program Info */}
              <div style={{ textAlign: 'center', padding: '16px 0', borderTop: '1px solid var(--border-card)', borderBottom: '1px solid var(--border-card)', marginBottom: '16px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-terracotta)', textTransform: 'uppercase' }}>
                  Resumen Académico
                </span>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                  Administración de Empresas
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Universidad de Cundinamarca · Chía
                </p>
              </div>

              {/* Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div style={{ backgroundColor: 'var(--bg-card)', padding: '12px', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>Avance de Carrera</span>
                  <strong style={{ fontSize: '20px', color: 'var(--color-terracotta)' }}>
                    {Math.round(metrics.completionPercentage)}%
                  </strong>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block' }}>
                    {metrics.completedCredits} / {metrics.totalCredits} cr
                  </span>
                </div>

                <div style={{ backgroundColor: 'var(--bg-card)', padding: '12px', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>Promedio Acumulado</span>
                  <strong style={{ fontSize: '20px', color: 'var(--color-steel)' }}>
                    {gpaMetrics.cumulativeGPA !== null ? gpaMetrics.cumulativeGPA.toFixed(2) : '—'}
                  </strong>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block' }}>
                    {gpaMetrics.gradedCoursesCount} mat. calificadas
                  </span>
                </div>
              </div>
            </div>

            {/* Share Button */}
            <button
              onClick={handleShare}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: 'var(--color-terracotta)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-terracotta)'
              }}
            >
              <Share2 size={18} />
              Compartir Ficha de Avance
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
