const REGIONS = [
  { id: 'arabic',     emoji: '🌙', label: 'Arabic',      desc: 'Maqam scales, oud, qanun',         color: '#c4954f' },
  { id: 'west_africa',emoji: '🥁', label: 'West Africa', desc: 'Polyrhythm, kora, balafon',         color: '#c47b4f' },
  { id: 'india',      emoji: '🪔', label: 'India',       desc: 'Ragas, sitar, tabla',               color: '#c4a04f' },
  { id: 'east_asia',  emoji: '🏮', label: 'East Asia',   desc: 'Pentatonic, erhu, guzheng',         color: '#4f8fc4' },
  { id: 'latin',      emoji: '🎺', label: 'Latin',       desc: 'Clave rhythms, brass, guitar',      color: '#c44f6b' },
  { id: 'europe',     emoji: '🎻', label: 'Europe',      desc: 'Classical, strings, piano',         color: '#7b6faf' },
  { id: 'global',     emoji: '🌍', label: 'Global Mix',  desc: 'Blend of world music traditions',   color: '#4fa882' },
]

export default function Onboarding({ onComplete }) {
  return (
    <div className="onboarding">
      <div className="ob-header">
        <div className="ob-logo">Ekko</div>
        <h1 className="ob-headline">Musical Mood <em>Journeys</em></h1>
        <p className="ob-sub">Where are your musical roots?<br />We'll shape your sound around your culture.</p>
      </div>

      <div className="ob-regions">
        {REGIONS.map(r => (
          <button
            key={r.id}
            className="ob-region"
            style={{ '--region-color': r.color }}
            onClick={() => onComplete(r)}
          >
            <span className="ob-emoji">{r.emoji}</span>
            <div className="ob-info">
              <span className="ob-region-label">{r.label}</span>
              <span className="ob-region-desc">{r.desc}</span>
            </div>
            <span className="ob-arrow">→</span>
          </button>
        ))}
      </div>

      <p className="ob-skip" onClick={() => onComplete(REGIONS.find(r => r.id === 'global'))}>
        Skip — use Global Mix
      </p>
    </div>
  )
}