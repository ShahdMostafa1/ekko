"""Procedural album-cover SVGs from mood + region (no external image API)."""
from __future__ import annotations
import base64
import hashlib
from xml.sax.saxutils import escape

EMOTION_GRADIENTS: dict[str, tuple[str, str]] = {
    "joy": ("#f5c842", "#ff6b35"),
    "sadness": ("#4a6fa5", "#1a1a2e"),
    "anger": ("#c0392b", "#2c0a0a"),
    "fear": ("#6c3483", "#1a0533"),
    "surprise": ("#2ecc71", "#145a32"),
    "neutral": ("#5d6d7e", "#2c3e50"),
    "disgust": ("#27ae60", "#1e3d2f"),
    "nostalgia": ("#d4a574", "#5c4033"),
    "hope": ("#f39c12", "#6c3483"),
    "love": ("#e84393", "#6c3483"),
    "anxiety": ("#8e44ad", "#2c3e50"),
    "calm": ("#48c9b0", "#1a5276"),
    "energetic": ("#f1c40f", "#e74c3c"),
    "motivated": ("#3498db", "#9b59b6"),
}

REGION_ACCENT: dict[str, str] = {
    "arabic": "#c9a84c",
    "west_africa": "#e07b39",
    "india": "#d4518a",
    "east_asia": "#7eb8c9",
    "latin": "#e04f4f",
    "europe": "#6e8efb",
    "global": "#a855f7",
}


def build_cover_data_url(
    emotion: str = "neutral",
    region: str = "global",
    title: str = "",
    mood_label: str = "",
) -> str:
    c1, c2 = EMOTION_GRADIENTS.get(emotion, EMOTION_GRADIENTS["neutral"])
    accent = REGION_ACCENT.get(region, "#7c5ce7")
    seed = hashlib.md5(f"{emotion}:{region}:{title}".encode()).hexdigest()
    rot = int(seed[:2], 16) % 40 - 20
    label = escape((title or mood_label or emotion or "Ekko")[:28])
    subtitle = escape((mood_label or region.replace("_", " ").title())[:24])

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:{c1}"/>
      <stop offset="100%" style="stop-color:{c2}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="35%" r="55%">
      <stop offset="0%" style="stop-color:{accent};stop-opacity:0.55"/>
      <stop offset="100%" style="stop-color:{accent};stop-opacity:0"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <rect width="512" height="512" fill="url(#glow)"/>
  <g transform="rotate({rot} 256 256)" opacity="0.35">
    <circle cx="256" cy="200" r="120" fill="none" stroke="{accent}" stroke-width="3"/>
    <circle cx="256" cy="200" r="80" fill="none" stroke="#fff" stroke-width="2"/>
  </g>
  <text x="256" y="380" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif" font-size="28" font-weight="700">{label}</text>
  <text x="256" y="420" text-anchor="middle" fill="rgba(255,255,255,0.75)" font-family="system-ui,sans-serif" font-size="16">{subtitle}</text>
  <text x="256" y="470" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-family="system-ui,sans-serif" font-size="12">EKKO</text>
</svg>"""
    b64 = base64.b64encode(svg.encode("utf-8")).decode("ascii")
    return f"data:image/svg+xml;base64,{b64}"
