import { useState, useEffect } from 'react'
import { useI18n } from '../i18n/I18nContext'

const PERKS = [
  { emoji: '🌍', key: 'regions' },
  { emoji: '🎭', key: 'moods' },
  { emoji: '⬇', key: 'download' },
  { emoji: '📚', key: 'history' },
]

export default function UpgradePlanCTA({ onUpgrade, onDismiss }) {
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 60)
    return () => clearTimeout(timer)
  }, [])

  const close = (cb) => {
    setLeaving(true)
    setTimeout(cb, 350)
  }

  const handleUpgrade = () => close(onUpgrade)
  const handleDismiss = () => close(onDismiss)

  const isShowing = visible && !leaving

  return (
    <div style={{
      position:       'fixed', inset: 0,
      background:     isShowing ? 'rgba(0,0,0,0.78)' : 'rgba(0,0,0,0)',
      backdropFilter: isShowing ? 'blur(10px)' : 'blur(0px)',
      display:        'flex', alignItems: 'center', justifyContent: 'center',
      zIndex:         1900, padding: 24,
      transition:     'background .35s ease, backdrop-filter .35s ease',
      pointerEvents:  isShowing ? 'auto' : 'none',
    }}>
      <div style={{
        background:   'linear-gradient(145deg, #0f0828 0%, #1a1040 55%, #0f0828 100%)',
        border:       '1.5px solid rgba(124,92,231,0.45)',
        borderRadius: 28, padding: '32px 26px 26px',
        maxWidth: 380, width: '100%',
        position: 'relative', overflow: 'hidden',
        boxShadow: '0 0 60px rgba(124,92,231,0.18), 0 32px 80px rgba(0,0,0,0.7)',
        opacity:   isShowing ? 1 : 0,
        transform: isShowing
          ? 'translateY(0) scale(1)'
          : leaving
          ? 'translateY(-16px) scale(0.96)'
          : 'translateY(24px) scale(0.94)',
        transition: 'opacity .38s cubic-bezier(.34,1.56,.64,1), transform .38s cubic-bezier(.34,1.56,.64,1)',
        textAlign: 'center',
        pointerEvents: isShowing ? 'auto' : 'none',
      }}>
        <div style={{ position:'absolute', top:-50, right:-50, width:180, height:180, borderRadius:'50%', background:'radial-gradient(circle, rgba(124,92,231,0.15) 0%, transparent 70%)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-40, left:-40, width:140, height:140, borderRadius:'50%', background:'radial-gradient(circle, rgba(167,139,250,0.1) 0%, transparent 70%)', pointerEvents:'none' }} />

        <div style={{ display:'inline-block', background:'rgba(124,92,231,0.15)', border:'1px solid rgba(124,92,231,0.35)', borderRadius:99, padding:'5px 14px', fontSize:10, fontWeight:800, color:'#c4b5fd', letterSpacing:'.1em', marginBottom:18, fontFamily:"'Syne',sans-serif" }}>
          {t('upgradeCta.badge')}
        </div>

        <div style={{ width:72, height:72, borderRadius:22, background:'linear-gradient(135deg, rgba(124,92,231,0.35), rgba(167,139,250,0.15))', border:'1.5px solid rgba(124,92,231,0.4)', boxShadow:'0 0 28px rgba(124,92,231,0.25)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:34, margin:'0 auto 16px', animation:'upgradePulse 2.5s ease-in-out infinite' }}>
          🌊
        </div>

        <h2 style={{ margin:'0 0 8px', fontSize:22, fontWeight:800, color:'#ede9fe', fontFamily:"'Syne',sans-serif", lineHeight:1.25 }}>
          {t('upgradeCta.title')}
        </h2>
        <p style={{ margin:'0 0 18px', fontSize:14, color:'#a78bfa', lineHeight:1.55, fontWeight:500 }}>
          {t('upgradeCta.subtitle')}
        </p>

        <ul style={{ listStyle:'none', margin:'0 0 22px', padding:0, textAlign:'left', display:'flex', flexDirection:'column', gap:10 }}>
          {PERKS.map(({ emoji, key }) => (
            <li key={key} style={{ display:'flex', alignItems:'flex-start', gap:10, fontSize:13, color:'#d4c4f0', lineHeight:1.45 }}>
              <span style={{ fontSize:16, lineHeight:1.2, flexShrink:0 }}>{emoji}</span>
              <span>{t(`upgradeCta.perks.${key}`)}</span>
            </li>
          ))}
        </ul>

        <div style={{ display:'inline-flex', alignItems:'baseline', gap:4, marginBottom:20, fontFamily:"'Syne',sans-serif" }}>
          <span style={{ fontSize:28, fontWeight:800, color:'#e9d5ff' }}>{t('upgradeCta.price')}</span>
          <span style={{ fontSize:13, color:'#8b7eb8', fontWeight:600 }}>{t('upgradeCta.pricePeriod')}</span>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <button
            type="button"
            onClick={handleUpgrade}
            style={{ width:'100%', padding:'14px', background:'linear-gradient(135deg, #6d28d9, #7c5ce7)', border:'none', borderRadius:16, color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", boxShadow:'0 6px 24px rgba(124,92,231,0.4)', transition:'transform .15s, box-shadow .15s' }}
            onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 28px rgba(124,92,231,0.5)' }}
            onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 6px 24px rgba(124,92,231,0.4)' }}
          >
            {t('upgradeCta.cta')}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            style={{ width:'100%', padding:'12px', background:'transparent', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, color:'#4b4570', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", transition:'color .2s, border-color .2s' }}
            onMouseEnter={e => { e.currentTarget.style.color='#8b7eb8'; e.currentTarget.style.borderColor='rgba(255,255,255,0.15)' }}
            onMouseLeave={e => { e.currentTarget.style.color='#4b4570'; e.currentTarget.style.borderColor='rgba(255,255,255,0.08)' }}
          >
            {t('upgradeCta.dismiss')}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes upgradePulse {
          0%, 100% { box-shadow: 0 0 28px rgba(124,92,231,0.25); }
          50%       { box-shadow: 0 0 44px rgba(124,92,231,0.45); }
        }
      `}</style>
    </div>
  )
}
