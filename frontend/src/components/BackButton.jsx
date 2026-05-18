export default function BackButton({ onClick, label = '← Back' }) {
  return (
    <button className="back-button" onClick={onClick}>
      <span className="back-arrow">←</span>
      <span className="back-label">{label}</span>
    </button>
  )
}