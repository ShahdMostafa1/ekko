import App from './App.jsx'
import ShareSongPage from './pages/ShareSongPage.jsx'
import ShareWrappedPage from './pages/ShareWrappedPage.jsx'

/** Route public share URLs before the main app shell. */
function parseShareRoute() {
  const path = typeof window !== 'undefined' ? window.location.pathname : ''
  const song = path.match(/^\/s\/([^/]+)\/?$/)
  if (song) return { type: 'song', id: decodeURIComponent(song[1]) }
  const memory = path.match(/^\/m\/([^/]+)\/?$/)
  if (memory) return { type: 'memory', id: decodeURIComponent(memory[1]) }
  const wrapped = path.match(/^\/wrapped\/([^/]+)\/?$/)
  if (wrapped) return { type: 'wrapped', id: decodeURIComponent(wrapped[1]) }
  return null
}

export default function ShareGate() {
  const route = parseShareRoute()
  if (route?.type === 'song') {
    return <ShareSongPage songId={route.id} />
  }
  if (route?.type === 'memory') {
    return <ShareSongPage songId={route.id} memoryView />
  }
  if (route?.type === 'wrapped') {
    return <ShareWrappedPage userId={route.id} />
  }
  return <App />
}
