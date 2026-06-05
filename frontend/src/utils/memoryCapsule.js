/** Memory capsule helpers — photo, place, note on saved songs. */
import { supabase } from '../lib/supabase.js'

export function hasMemory(song) {
  if (!song) return false
  return !!(
    (song.memory_note && song.memory_note.trim())
    || (song.memory_location && song.memory_location.trim())
    || (song.memory_photo_url && song.memory_photo_url.trim())
  )
}

export function memoryDisplayTitle(song) {
  if (!song) return ''
  if (song.memory_location?.trim()) return song.memory_location.trim()
  if (song.title?.trim()) return song.title.trim()
  if (song.mood_label?.trim()) return song.mood_label.trim()
  return 'Memory capsule'
}

export function resizeImageToDataUrl(file, maxDim = 960, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      const scale = Math.min(1, maxDim / Math.max(width, height, 1))
      width = Math.max(1, Math.round(width * scale))
      height = Math.max(1, Math.round(height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas not supported'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      resolve(dataUrl)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not load image'))
    }
    img.src = url
  })
}

/** Upload to Supabase Storage, or return compressed data URL as fallback. */
export async function uploadMemoryPhoto(userId, songId, file) {
  const dataUrl = await resizeImageToDataUrl(file)

  try {
    const blob = await (await fetch(dataUrl)).blob()
    const path = `${userId}/${songId}-${Date.now()}.jpg`
    const { error } = await supabase.storage
      .from('song-memories')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('song-memories').getPublicUrl(path)
      if (data?.publicUrl) return data.publicUrl
    }
  } catch (e) {
    console.warn('[memory] storage upload skipped:', e)
  }

  if (dataUrl.length > 450_000) {
    return resizeImageToDataUrl(file, 640, 0.72)
  }
  return dataUrl
}

export async function patchSongMemory(songId, userId, { note, location, photoUrl }) {
  const body = { user_id: userId }
  if (note !== undefined) body.memory_note = note
  if (location !== undefined) body.memory_location = location
  if (photoUrl !== undefined) body.memory_photo_url = photoUrl

  const res = await fetch(`${import.meta.env.VITE_API_URL}/music/${songId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Save failed (${res.status})`)
  return res.json()
}
