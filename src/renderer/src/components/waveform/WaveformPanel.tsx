import { useEffect, useRef, useState, useCallback } from 'react'
import { useStore, useSelectedCue } from '../../store'
import { audioPlayer } from '../../engine/AudioPlayer'
import type { AudioCue } from '../../types/cue'
import './WaveformPanel.css'

const WAVEFORM_COLOR = '#2a6099'
const WAVEFORM_COLOR_PLAYED = '#4a9eff'
const PLAYHEAD_COLOR = '#ffffff'
const BG_COLOR = '#111'
const DPR = window.devicePixelRatio || 1

function drawWaveform(
  canvas: HTMLCanvasElement,
  buffer: AudioBuffer,
  playFraction: number,
  startFraction: number
) {
  const width = canvas.width
  const height = canvas.height
  const ctx = canvas.getContext('2d')!

  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = BG_COLOR
  ctx.fillRect(0, 0, width, height)

  // Center line
  ctx.strokeStyle = '#1e1e1e'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, height / 2)
  ctx.lineTo(width, height / 2)
  ctx.stroke()

  // Merge channels (up to stereo) for min/max per column
  const channels = Math.min(buffer.numberOfChannels, 2)
  const totalSamples = buffer.length
  const samplesPerPixel = totalSamples / width

  const playedX = Math.floor(playFraction * width)
  const startX = Math.floor(startFraction * width)

  for (let x = 0; x < width; x++) {
    const sampleStart = Math.floor(x * samplesPerPixel)
    const sampleEnd = Math.min(Math.floor((x + 1) * samplesPerPixel), totalSamples)

    let min = 0, max = 0
    for (let ch = 0; ch < channels; ch++) {
      const data = buffer.getChannelData(ch)
      for (let s = sampleStart; s < sampleEnd; s++) {
        const v = data[s]
        if (v < min) min = v
        if (v > max) max = v
      }
    }

    const yMid = height / 2
    const yMax = yMid - max * yMid
    const yMin = yMid - min * yMid
    const barHeight = Math.max(1, yMin - yMax)

    ctx.fillStyle = x <= playedX ? WAVEFORM_COLOR_PLAYED : WAVEFORM_COLOR
    ctx.fillRect(x, yMax, 1, barHeight)
  }

  // Start time marker
  if (startFraction > 0) {
    ctx.strokeStyle = '#e0a020'
    ctx.lineWidth = 1 * DPR
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(startX, 0)
    ctx.lineTo(startX, height)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Playhead
  if (playFraction > 0 && playFraction < 1) {
    ctx.strokeStyle = PLAYHEAD_COLOR
    ctx.lineWidth = 1.5 * DPR
    ctx.beginPath()
    ctx.moveTo(playedX, 0)
    ctx.lineTo(playedX, height)
    ctx.stroke()

    // Playhead handle triangle
    ctx.fillStyle = PLAYHEAD_COLOR
    ctx.beginPath()
    ctx.moveTo(playedX - 5, 0)
    ctx.lineTo(playedX + 5, 0)
    ctx.lineTo(playedX, 8)
    ctx.fill()
  }
}

function formatTime(ms: number): string {
  const s = ms / 1000
  const min = Math.floor(s / 60)
  const sec = s % 60
  return `${min}:${sec.toFixed(1).padStart(4, '0')}`
}

export function WaveformPanel() {
  const selectedCue = useSelectedCue()
  const updateCue = useStore(s => s.updateCue)
  const syncCueDuration = useStore(s => s.syncCueDuration)
  const running = useStore(s => s.running)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const bufferRef = useRef<AudioBuffer | null>(null)

  const [buffer, setBuffer] = useState<AudioBuffer | null>(null)
  const [loading, setLoading] = useState(false)
  const [playFraction, setPlayFraction] = useState(0)
  const [hoverFraction, setHoverFraction] = useState<number | null>(null)

  const audioCue = selectedCue?.type === 'audio' ? selectedCue as AudioCue : null
  const runState = audioCue ? running.get(audioCue.id) : undefined
  const isPlaying = runState?.state === 'playing'

  // Load buffer when selected audio cue or its file changes
  useEffect(() => {
    if (!audioCue?.filePath) { setBuffer(null); return }

    const cached = audioPlayer.getBuffer(audioCue.filePath)
    if (cached) { setBuffer(cached); bufferRef.current = cached; return }

    setLoading(true)
    audioPlayer.load(audioCue.filePath).then(buf => {
      setBuffer(buf)
      bufferRef.current = buf
      syncCueDuration(audioCue.id, Math.round(buf.duration * 1000))
    }).finally(() => setLoading(false))
  }, [audioCue?.filePath, audioCue?.id, syncCueDuration])

  // rAF loop for playhead while playing
  useEffect(() => {
    if (!isPlaying || !audioCue) {
      if (!isPlaying) setPlayFraction(audioCue ? (audioCue.startTime / 1000) / (buffer?.duration || 1) : 0)
      return
    }
    const tick = () => {
      const prog = audioPlayer.getProgress(audioCue.id)
      if (prog) setPlayFraction(prog.fraction)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isPlaying, audioCue?.id])

  // Redraw canvas whenever buffer, playFraction, or size changes
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const buf = bufferRef.current
    if (!canvas || !buf) return
    const startFrac = audioCue ? audioCue.startTime / 1000 / buf.duration : 0
    drawWaveform(canvas, buf, playFraction, startFrac)
  }, [buffer, playFraction, audioCue?.startTime])

  useEffect(draw, [draw])

  // Resize observer to redraw when panel width changes
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const { width, height } = el.getBoundingClientRect()
      canvas.width = Math.floor(width * DPR)
      canvas.height = Math.floor(height * DPR)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      draw()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [draw])

  const fractionFromEvent = (e: React.MouseEvent<HTMLCanvasElement>): number => {
    const rect = e.currentTarget.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  }

  const handleClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!audioCue || !buffer) return
    const fraction = fractionFromEvent(e)
    const timeSeconds = fraction * buffer.duration
    const timeMs = timeSeconds * 1000

    // Always update the cue's startTime
    updateCue(audioCue.id, { startTime: timeMs })

    // If currently playing, seek in-place
    if (isPlaying) {
      await audioPlayer.seek(audioCue.id, timeSeconds)
    }

    setPlayFraction(fraction)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setHoverFraction(fractionFromEvent(e))
  }

  if (!audioCue) return null

  const totalDuration = buffer?.duration ?? audioCue.duration / 1000
  const hoverTime = hoverFraction != null ? hoverFraction * totalDuration : null
  const playTime = playFraction * totalDuration
  const startTimeSec = audioCue.startTime / 1000

  return (
    <div className="waveform-panel">
      <div className="waveform-header">
        <span className="waveform-filename">
          {audioCue.filePath ? audioCue.filePath.split(/[\\/]/).pop() : 'No file selected'}
        </span>
        <span className="waveform-times">
          {isPlaying && <span className="waveform-elapsed">{formatTime(playTime * 1000)}</span>}
          {hoverTime != null && !isPlaying && (
            <span className="waveform-hover">{formatTime(hoverTime * 1000)}</span>
          )}
          <span className="waveform-total">{formatTime(totalDuration * 1000)}</span>
        </span>
        {audioCue.startTime > 0 && (
          <span className="waveform-start-tag">
            start: {formatTime(startTimeSec * 1000)}
            <button
              onClick={() => updateCue(audioCue.id, { startTime: 0 })}
              title="Reset start time"
            >✕</button>
          </span>
        )}
      </div>
      <div ref={containerRef} className="waveform-canvas-container">
        {loading && <div className="waveform-loading">Loading waveform…</div>}
        {!loading && !buffer && audioCue.filePath && (
          <div className="waveform-loading">Could not decode audio.</div>
        )}
        {!audioCue.filePath && (
          <div className="waveform-loading">No audio file selected.</div>
        )}
        <canvas
          ref={canvasRef}
          className="waveform-canvas"
          style={{ opacity: loading || !buffer ? 0 : 1 }}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverFraction(null)}
          title="Click to set start time / seek"
        />
      </div>
    </div>
  )
}
