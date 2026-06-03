import { useState, useEffect, useRef } from 'react'
import {
  getPreQuestions,
  getPostQuestions,
  EMPTY_SURVEY_FORM,
  validateSurveyForm,
  buildSurveyPayload,
} from '../utils/surveyQuestions'
import { fetchSurveyStatus, patchSurveyStatusCache } from '../utils/tagline'
import { useI18n } from '../i18n/I18nContext.jsx'

const API = import.meta.env.VITE_API_URL

/** One question — vertical answer list tied to that question’s wording */
function ScaleRow({ label, scale, value, onChange }) {
  return (
    <div className="ss-block">
      <span className="ss-label">{label}</span>
      <div className="ss-options" role="group" aria-label={label}>
        {scale.map(({ value: v, label: lbl }) => (
          <button
            key={v}
            type="button"
            className={`ss-option ${value === v ? 'ss-option--on' : ''}`}
            onClick={() => onChange(v)}
            aria-pressed={value === v}
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>
  )
}

function OptionGroup({ label, options, value, onChange }) {
  return (
    <div className="ss-block">
      <span className="ss-label">{label}</span>
      <div className="ss-options">
        {options.map(opt => (
          <button
            key={opt.id}
            type="button"
            className={`ss-option ${value === opt.id ? 'ss-option--on' : ''}`}
            onClick={() => onChange(opt.id)}
            aria-pressed={value === opt.id}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function MultiChipGroup({ label, options, value = [], onChange, min = 1, genreHint }) {
  const toggle = (id) => {
    if (value.includes(id)) onChange(value.filter(v => v !== id))
    else onChange([...value, id])
  }
  return (
    <div className="ss-block">
      <span className="ss-label">{label}</span>
      <div className="ss-chips">
        {options.map(opt => (
          <button
            key={opt.id}
            type="button"
            className={`ss-chip ${value.includes(opt.id) ? 'ss-chip--on' : ''}`}
            onClick={() => toggle(opt.id)}
            aria-pressed={value.includes(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {value.length < min && genreHint && (
        <p className="ss-hint">{genreHint}</p>
      )}
    </div>
  )
}

function QuestionField({ q, form, setForm, genreHint }) {
  const setVal = (key, val) => setForm(f => ({ ...f, [key]: val }))
  if (q.type === 'scale' || q.type === 'likert') {
    return (
      <ScaleRow
        label={q.label}
        scale={q.scale}
        value={form[q.key]}
        onChange={v => setVal(q.key, v)}
      />
    )
  }
  if (q.type === 'choice') {
    return (
      <OptionGroup
        label={q.label}
        options={q.options}
        value={form[q.key]}
        onChange={v => setVal(q.key, v)}
      />
    )
  }
  if (q.type === 'multi') {
    return (
      <MultiChipGroup
        label={q.label}
        options={q.options}
        value={form[q.key]}
        onChange={v => setVal(q.key, v)}
        min={q.min}
        genreHint={genreHint}
      />
    )
  }
  if (q.type === 'text') {
    return (
      <div className="ss-block ss-block--text">
        <label className="ss-field">
          <span className="ss-label">{q.label}</span>
          <textarea
            className="ss-textarea"
            rows={q.rows || 2}
            value={form[q.key] || ''}
            onChange={e => setVal(q.key, e.target.value)}
            placeholder={q.placeholder || ''}
          />
        </label>
      </div>
    )
  }
  return null
}

export default function StudySurvey({
  userId = '',
  initialPhase = null,
  lockPhase = false,
  initialStatus = null,
  gateNotice = '',
  onComplete,
  onStatusChange,
}) {
  const { t, locale, isRtl } = useI18n()
  const [phase, setPhase]           = useState(initialPhase || 'pre')
  const [status, setStatus]         = useState(initialStatus || { pre_done: false, post_done: false })
  const [loading, setLoading]       = useState(!initialStatus)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]             = useState(false)
  const [error, setError]           = useState('')
  const [form, setForm]             = useState({ ...EMPTY_SURVEY_FORM })
  const autoSkippedRef              = useRef(false)

  useEffect(() => {
    if (initialStatus) {
      setStatus(initialStatus)
      setLoading(false)
    }
  }, [initialStatus])

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    if (initialStatus) return
    fetch(`${API}/survey/status/${userId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return
        setStatus(data)
        onStatusChange?.(data)
        if (!initialPhase) {
          if (!data.pre_done) setPhase('pre')
          else if (!data.post_done) setPhase('post')
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId, initialPhase, initialStatus, onStatusChange])

  const isPre = phase === 'pre'
  const phaseDone = isPre ? status.pre_done : status.post_done

  useEffect(() => {
    if (loading || !lockPhase || !phaseDone || autoSkippedRef.current) return
    autoSkippedRef.current = true
    onComplete?.(phase)
  }, [loading, lockPhase, phaseDone, phase, onComplete])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!userId) {
      setError(t('survey.signInRequired'))
      return
    }
    const validationError = validateSurveyForm(form, phase, locale)
    if (validationError) {
      setError(validationError)
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const payload = buildSurveyPayload(form, userId, phase)
      const res = await fetch(`${API}/survey/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || `HTTP ${res.status}`)
      }
      const body = await res.json().catch(() => ({}))
      if (body.warning) console.warn('[survey]', body.warning)
      const fresh = await fetchSurveyStatus(userId, { force: true })
      setDone(true)
      setStatus(fresh)
      patchSurveyStatusCache(userId, fresh)
      onStatusChange?.(fresh)
      if (lockPhase) onComplete?.(phase)
    } catch (err) {
      setError(err.message || t('survey.saveFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const questions = isPre ? getPreQuestions(locale) : getPostQuestions(locale)
  const multiHint = (minVal) => t(minVal > 1 ? 'survey.selectGenresMinPlural' : 'survey.selectGenresMin', { min: minVal })

  if (loading || (lockPhase && phaseDone)) {
    return (
      <div className="ss-root" dir={isRtl ? 'rtl' : 'ltr'}>
        <p className="ss-muted">{lockPhase && phaseDone ? t('survey.continuing') : t('survey.loading')}</p>
      </div>
    )
  }

  if (phaseDone && !done) {
    return (
      <div className="ss-root ss-root--done" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="ss-done-icon">✓</div>
        <h2 className="ss-title">{t('survey.alreadyTitle')}</h2>
        <p className="ss-sub">
          {isPre ? t('survey.alreadyPre') : t('survey.alreadyPost')}
        </p>
        {!lockPhase && (
          <div className="ss-phase-tabs">
            <button
              type="button"
              className={`ss-phase-tab ${phase === 'pre' ? 'ss-phase-tab--active' : ''}`}
              onClick={() => setPhase('pre')}
            >
              {t('survey.tabPre')} {status.pre_done && '✓'}
            </button>
            <button
              type="button"
              className={`ss-phase-tab ${phase === 'post' ? 'ss-phase-tab--active' : ''}`}
              onClick={() => setPhase('post')}
            >
              {t('survey.tabPost')} {status.post_done && '✓'}
            </button>
          </div>
        )}
        {!lockPhase && (
          <button type="button" className="ss-btn" onClick={() => onComplete?.(phase)}>
            {t('survey.backEkko')}
          </button>
        )}
      </div>
    )
  }

  if (done) {
    return (
      <div className="ss-root ss-root--done" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="ss-done-icon">✓</div>
        <h2 className="ss-title">{t('survey.thankYou')}</h2>
        <p className="ss-sub">
          {phase === 'pre' ? t('survey.savedPre') : t('survey.savedPost')}
          {phase === 'pre' && !status.post_done && !lockPhase && t('survey.savedPostHint')}
        </p>
        {(lockPhase || onComplete) && (
          <button type="button" className="ss-btn" onClick={() => onComplete?.(phase)}>
            {phase === 'pre' ? t('survey.continueEkko') : t('survey.done')}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="ss-root" dir={isRtl ? 'rtl' : 'ltr'}>
      {gateNotice && lockPhase && (
        <div className="ss-gate-banner" role="status">
          <span aria-hidden="true">📋</span>
          <p>{gateNotice}</p>
        </div>
      )}

      <div className="ss-header">
        <p className="ss-eyebrow">{isPre ? t('survey.eyebrowPre') : t('survey.eyebrowPost')}</p>
        <h1 className="ss-title">{isPre ? t('survey.titlePre') : t('survey.titlePost')}</h1>
        <p className="ss-sub">
          {isPre ? t('survey.subPre') : t('survey.subPost')}
        </p>
      </div>

      {!lockPhase && (
        <div className="ss-phase-tabs">
          <button
            type="button"
            className={`ss-phase-tab ${phase === 'pre' ? 'ss-phase-tab--active' : ''}`}
            onClick={() => setPhase('pre')}
          >
            {t('survey.tabPre')} {status.pre_done && '✓'}
          </button>
          <button
            type="button"
            className={`ss-phase-tab ${phase === 'post' ? 'ss-phase-tab--active' : ''}`}
            onClick={() => setPhase('post')}
          >
            {t('survey.tabPost')} {status.post_done && '✓'}
          </button>
        </div>
      )}

      <form className="ss-form" onSubmit={handleSubmit}>
        {questions.map(q => (
          <QuestionField
            key={q.key}
            q={q}
            form={form}
            setForm={setForm}
            genreHint={q.type === 'multi' ? multiHint(q.min || 1) : undefined}
          />
        ))}

        <div className="ss-block ss-block--text">
          <label className="ss-field">
            <span className="ss-label">
              {t('survey.improvements')} <span className="ss-optional">{t('survey.optional')}</span>
            </span>
            <textarea
              className="ss-textarea"
              rows={3}
              value={form.improvements_needed}
              onChange={e => setForm(f => ({ ...f, improvements_needed: e.target.value }))}
              placeholder={t('survey.improvementsPlaceholder')}
            />
          </label>
        </div>

        {error && <p className="ss-error">{error}</p>}

        <button type="submit" className="ss-btn" disabled={submitting}>
          {submitting ? t('survey.saving') : (isPre ? t('survey.submitPre') : t('survey.submitPost'))}
        </button>
      </form>

      <style>{`
        .ss-root {
          font-family: 'DM Sans', 'Segoe UI', sans-serif;
          max-width: 520px;
          margin: 0 auto;
          padding-bottom: 48px;
        }
        .ss-root--done { text-align: center; padding-top: 24px; }
        .ss-done-icon {
          width: 64px; height: 64px; border-radius: 50%;
          background: rgba(52,211,153,.15); border: 2px solid rgba(52,211,153,.4);
          color: #34d399; font-size: 28px; font-weight: 800;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 16px;
        }
        .ss-gate-banner {
          display: flex; align-items: flex-start; gap: 10px;
          margin-bottom: 16px; padding: 12px 14px;
          background: rgba(124, 92, 231, 0.12);
          border: 1px solid rgba(168, 85, 247, 0.35);
          border-radius: 12px;
        }
        .ss-gate-banner span { font-size: 18px; flex-shrink: 0; }
        .ss-gate-banner p {
          margin: 0; font-size: 13px; font-weight: 600;
          color: #c4b5f0; line-height: 1.5;
        }
        .ss-header { text-align: center; margin-bottom: 20px; }
        .ss-eyebrow {
          font-size: 11px; font-weight: 700; color: #a78bfa;
          text-transform: uppercase; letter-spacing: .1em; margin: 0 0 8px;
        }
        .ss-title { font-size: 1.5rem; font-weight: 800; color: #e0d8ff; margin: 0 0 8px; }
        .ss-sub { font-size: 14px; color: #8b7eb8; margin: 0; line-height: 1.55; }
        .ss-muted { text-align: center; color: #6b5f8a; padding: 40px 0; }
        .ss-phase-tabs {
          display: flex; gap: 6px; margin-bottom: 16px;
          background: rgba(255,255,255,.04); border-radius: 12px; padding: 4px;
        }
        .ss-phase-tab {
          flex: 1; padding: 10px; border: none; border-radius: 10px;
          background: transparent; color: #6b5f8a; font-size: 13px; font-weight: 700;
          cursor: pointer; font-family: inherit;
        }
        .ss-phase-tab--active {
          background: rgba(124,92,231,.25); color: #e0d8ff;
          border: 1px solid rgba(168,85,247,.35);
        }
        .ss-banner {
          font-size: 12px; color: #fbbf24; background: rgba(251,191,36,.08);
          border: 1px solid rgba(251,191,36,.25); border-radius: 10px;
          padding: 10px 14px; margin-bottom: 16px;
        }
        .ss-form { display: flex; flex-direction: column; gap: 22px; }
        .ss-block {
          display: flex; flex-direction: column; gap: 10px;
          padding: 14px 16px;
          background: rgba(255,255,255,.03);
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 14px;
        }
        .ss-block--text { background: transparent; border: none; padding: 0; }
        .ss-field { display: flex; flex-direction: column; gap: 8px; }
        .ss-label { font-size: 13px; font-weight: 700; color: #c4b5f0; line-height: 1.45; }
        .ss-optional { font-weight: 500; color: #6b5f8a; font-size: 12px; }
        .ss-hint { font-size: 11px; color: #6b5f8a; margin: 0; }
        .ss-options { display: flex; flex-direction: column; gap: 8px; }
        .ss-option {
          text-align: left; padding: 12px 14px; border-radius: 12px;
          background: rgba(255,255,255,.04);
          border: 1.5px solid rgba(176,158,224,.12);
          color: #b09ee0; font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: inherit;
          transition: border-color .15s, background .15s;
        }
        .ss-option--on {
          background: rgba(124,92,231,.2);
          border-color: rgba(168,85,247,.5);
          color: #f0ecff;
        }
        .ss-chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .ss-chip {
          padding: 8px 14px; border-radius: 999px;
          background: rgba(255,255,255,.05);
          border: 1.5px solid rgba(176,158,224,.15);
          color: #b09ee0; font-size: 12px; font-weight: 600;
          cursor: pointer; font-family: inherit;
          transition: border-color .15s, background .15s;
        }
        .ss-chip--on {
          background: rgba(124,92,231,.25);
          border-color: rgba(168,85,247,.5);
          color: #f0ecff;
        }
        .ss-textarea {
          width: 100%; box-sizing: border-box;
          padding: 12px 14px; border-radius: 12px;
          background: rgba(255,255,255,.05);
          border: 1.5px solid rgba(176,158,224,.15);
          color: #e0d8ff; font-size: 14px; font-family: inherit;
          resize: vertical; min-height: 72px; outline: none;
        }
        .ss-textarea:focus { border-color: rgba(124,92,231,.5); }
        .ss-textarea::placeholder { color: #6b5f8a; }
        .ss-error {
          font-size: 13px; color: #f87171;
          background: rgba(248,113,113,.08); border-radius: 10px; padding: 10px 14px; margin: 0;
        }
        .ss-btn {
          width: 100%; padding: 14px; border: none; border-radius: 14px;
          background: linear-gradient(135deg, #7c5ce7, #a855f7);
          color: #fff; font-size: 15px; font-weight: 700; cursor: pointer;
          font-family: inherit; margin-top: 4px;
        }
        .ss-btn:disabled { opacity: .6; cursor: not-allowed; }
        @media (max-width: 480px) {
          .ss-root { max-width: 100%; }
          .ss-title { font-size: 1.3rem; }
        }
      `}</style>
    </div>
  )
}
