import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronRight, Clock3, Expand, FolderOpen, HardDrive, MapPin, Maximize2, Minimize2, Pause, Play, RotateCcw, Shield, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-react'
import { cameras, loadLibrary, reasonLabel, segmentAt, type Camera, type Category, type Recording } from './library'
import './App.css'

const cameraNames: Record<Camera, string> = {
  front: 'Avant', left_repeater: 'Répétiteur gauche', right_repeater: 'Répétiteur droit',
  back: 'Arrière', left_pillar: 'Montant gauche', right_pillar: 'Montant droit',
}
const categoryNames: Record<Category, string> = {
  SentryClips: 'Sentinelle', SavedClips: 'Sauvegardés', RecentClips: 'Récents',
}
const dateFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const shortDateFormat = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' })

function duration(seconds: number) {
  const value = Math.max(0, Math.floor(seconds))
  return `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`
}

function CameraTile({ camera, url, offset, playing, muted, focused, onFocus, videoRef }: {
  camera: Camera; url?: string; offset: number; playing: boolean; muted: boolean
  focused: boolean; onFocus: () => void; videoRef: (element: HTMLVideoElement | null) => void
}) {
  const [failed, setFailed] = useState(false)

  return <div className={`camera-tile camera-${camera} ${focused ? 'camera-focused' : ''}`}>
    {url && !failed ? <video
      ref={videoRef} src={url} muted={muted} playsInline preload="metadata"
      onLoadedMetadata={(event) => {
        const video = event.currentTarget
        video.currentTime = Math.min(offset, Math.max(0, video.duration - 0.1))
        if (playing) void video.play().catch(() => {})
      }}
      onError={() => setFailed(true)}
    /> : <div className="camera-empty"><span>{failed ? 'Vidéo non prise en charge par ce navigateur' : 'Aucun enregistrement'}</span></div>}
    <div className="camera-top"><span className="camera-indicator" /> {cameraNames[camera]}</div>
    {url && !failed && <button className="camera-hitarea" onClick={onFocus} title={focused ? 'Quitter le focus' : `Agrandir ${cameraNames[camera]}`} aria-label={focused ? 'Quitter le focus' : `Agrandir ${cameraNames[camera]}`} />}
    {url && !failed && <button className="camera-focus-button icon-button" onClick={onFocus} title={focused ? 'Quitter le focus' : 'Agrandir cette caméra'} aria-label={focused ? 'Quitter le focus' : `Agrandir ${cameraNames[camera]}`}>
      {focused ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
    </button>}
  </div>
}

function App() {
  const inputRef = useRef<HTMLInputElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const videoRefs = useRef<Partial<Record<Camera, HTMLVideoElement | null>>>({})
  const playbackTimeRef = useRef(0)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [sourceName, setSourceName] = useState('Aucun dossier ouvert')
  const [selectedId, setSelectedId] = useState('')
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [date, setDate] = useState('')
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [focus, setFocus] = useState<Camera | null>(null)
  const [urls, setUrls] = useState<{ segment?: number; files: Partial<Record<Camera, string>> }>({ files: {} })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [today] = useState(() => Date.now())

  const filtered = recordings.filter((recording) =>
    (category === 'all' || recording.category === category) &&
    (!date || new Date(recording.end - 1).toLocaleDateString('sv-SE') === date))
  const selected = recordings.find((recording) => recording.id === selectedId)
  const active = selected ? segmentAt(selected, time) : undefined
  const activeStart = active?.start
  const activeFiles = active?.files
  const totalSeconds = selected ? (selected.end - selected.start) / 1000 : 0
  const availableCameras = selected ? cameras.filter((camera) => selected.segments.some((segment) => segment.files[camera])) : []

  async function openFiles(files: FileList | null) {
    if (!files?.length) return
    setLoading(true)
    setMessage('')
    try {
      const result = await loadLibrary(files)
      if (!result.length) {
        setMessage('Aucune vidéo Tesla trouvée. Sélectionnez TeslaCam, un de ses sous-dossiers ou un dossier d’événement.')
        return
      }
      setPlaying(false)
      setFocus(null)
      setRecordings(result)
      setCategory('all')
      setDate('')
      setSelectedId(result[0].id)
      setTime(result[0].start)
      playbackTimeRef.current = result[0].start
      setSourceName(files[0].webkitRelativePath.split('/')[0] || 'Dossier local')
    } catch {
      setMessage('Impossible de lire ce dossier. Vérifiez l’accès aux fichiers et réessayez.')
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function selectRecording(recording: Recording) {
    setSelectedId(recording.id)
    setTime(recording.start)
    playbackTimeRef.current = recording.start
    setPlaying(false)
    setFocus(null)
  }

  function seek(next: number) {
    if (!selected) return
    const value = Math.min(selected.end - 100, Math.max(selected.start, next))
    setTime(value)
    playbackTimeRef.current = value
    const segment = segmentAt(selected, value)
    if (segment && segment.start === activeStart) {
      for (const video of Object.values(videoRefs.current)) {
        if (video?.readyState) video.currentTime = Math.min((value - segment.start) / 1000, Math.max(0, video.duration - 0.1))
      }
    }
  }

  useEffect(() => {
    if (!activeFiles || activeStart === undefined) { videoRefs.current = {}; return }
    const next: Partial<Record<Camera, string>> = {}
    for (const camera of cameras) {
      const file = activeFiles[camera]
      if (file) next[camera] = URL.createObjectURL(file)
    }
    setUrls({ segment: activeStart, files: next })
    return () => {
      for (const url of Object.values(next)) URL.revokeObjectURL(url)
    }
  }, [activeFiles, activeStart, selectedId])

  useEffect(() => {
    for (const video of Object.values(videoRefs.current)) {
      if (!video) continue
      if (playing) void video.play().catch(() => {})
      else video.pause()
    }
  }, [playing, activeStart])

  useEffect(() => {
    if (!playing || !selected) return
    let previous = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      const delta = now - previous
      previous = now
      const next = Math.min(playbackTimeRef.current + delta, selected.end - 100)
      playbackTimeRef.current = next
      setTime(next)
      if (next >= selected.end - 100) setPlaying(false)
      const segment = segmentAt(selected, next)
      if (segment && segment.start === activeStart) {
        for (const video of Object.values(videoRefs.current)) {
          if (video?.readyState && Math.abs(video.currentTime - (next - segment.start) / 1000) > 0.4) {
            video.currentTime = Math.min((next - segment.start) / 1000, Math.max(0, video.duration - 0.1))
          }
        }
      }
    }, 100)
    return () => window.clearInterval(timer)
  }, [playing, selected, activeStart])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setFocus(null)
      if (event.code === 'Space' && !['INPUT', 'BUTTON'].includes((event.target as HTMLElement).tagName)) {
        event.preventDefault()
        setPlaying((value) => !value)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const grouped = filtered.reduce<Record<string, Recording[]>>((days, recording) => {
    const day = new Date(recording.end - 1).toLocaleDateString('sv-SE')
    ;(days[day] ||= []).push(recording)
    return days
  }, {})

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><span /></span><div><strong>TESLACAM</strong><small>STUDIO</small></div></div>
      <div className="source-box"><div className="source-icon"><HardDrive size={19} /></div><div className="source-copy"><span>SOURCE LOCALE</span><strong title={sourceName}>{sourceName}</strong></div><span className={`source-dot ${recordings.length ? 'connected' : ''}`} /></div>
      <button className="open-button" onClick={() => inputRef.current?.click()} disabled={loading}><FolderOpen size={18} /> {loading ? 'Lecture du dossier…' : recordings.length ? 'Changer de dossier' : 'Ouvrir un dossier'}</button>
      <input ref={inputRef} type="file" multiple {...{ webkitdirectory: '', directory: '' }} className="visually-hidden" onChange={(event) => void openFiles(event.target.files)} aria-label="Sélectionner un dossier TeslaCam" />

      <div className="sidebar-heading"><span>BIBLIOTHÈQUE</span><span>{recordings.length}</span></div>
      <div className="category-list">
        {([['all', 'Tous les clips'], ['SentryClips', 'Sentinelle'], ['SavedClips', 'Sauvegardés'], ['RecentClips', 'Récents']] as const).map(([value, label]) =>
          <button key={value} className={`category-button ${category === value ? 'active' : ''}`} onClick={() => setCategory(value)}><span>{value === 'SentryClips' ? <Shield size={17} /> : value === 'all' ? <Expand size={17} /> : <FolderOpen size={17} />}{label}</span><small>{value === 'all' ? recordings.length : recordings.filter((item) => item.category === value).length}</small></button>)}
      </div>

      <div className="sidebar-heading date-heading"><span>DATE</span>{date && <button onClick={() => setDate('')} title="Effacer le filtre de date" aria-label="Effacer le filtre de date"><X size={15} /></button>}</div>
      <label className="date-filter"><CalendarDays size={17} /><input type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label="Filtrer par date" /></label>
      <div className="sidebar-bottom"><span className="privacy-dot" /> Vidéos conservées sur votre appareil</div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs">BIBLIOTHÈQUE <ChevronRight size={14} /> <strong>{selected ? categoryNames[selected.category].toUpperCase() : 'LECTEUR'}</strong></div><div className="topbar-right"><span className="local-pill"><span /> 100% LOCAL</span><span className="topbar-date">{new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(today)}</span></div></header>
      <div className="workspace">
        <section className="events-panel"><div className="panel-header"><div><span className="eyebrow">EXPLORATEUR</span><h2>Enregistrements</h2></div><span className="result-count">{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</span></div>
          <div className="event-scroll">{Object.entries(grouped).map(([day, items]) => <div className="day-group" key={day}><div className="day-label"><span>{dateFormat.format(new Date(day + 'T12:00:00'))}</span><span>{items.length}</span></div>
            {items.map((recording) => <button key={recording.id} className={`event-row ${selectedId === recording.id ? 'selected' : ''}`} onClick={() => selectRecording(recording)}><span className={`event-type ${recording.category}`}><span /></span><span className="event-details"><strong>{timeFormat.format(recording.metadata?.timestamp && Number.isFinite(Date.parse(recording.metadata.timestamp)) ? Date.parse(recording.metadata.timestamp) : recording.end)}</strong><span>{recording.category === 'RecentClips' ? 'Enregistrements récents' : reasonLabel(recording.metadata?.reason)}</span><small>{recording.metadata?.city || categoryNames[recording.category]} · {duration((recording.end - recording.start) / 1000)}</small></span><ChevronRight size={16} className="event-chevron" /></button>)}
          </div>)}{!filtered.length && <div className="empty-list">{recordings.length ? 'Aucun clip pour ce filtre.' : 'Les événements apparaîtront ici après sélection du dossier.'}</div>}</div>
        </section>

        <section className="viewer-panel">{message && <div className="notice" role="alert">{message}<button onClick={() => setMessage('')} aria-label="Fermer"><X size={16} /></button></div>}
          {selected ? <>
            <div className="viewer-heading"><div><div className="eyebrow"><span className={`tiny-status ${selected.category}`} /> {categoryNames[selected.category].toUpperCase()} <span className="eyebrow-divider">/</span> {shortDateFormat.format(selected.start).toUpperCase()}</div><h1>{selected.category === 'RecentClips' ? 'Enregistrements récents' : reasonLabel(selected.metadata?.reason)}</h1><div className="viewer-subtitle"><span><CalendarDays size={15} /> {dateFormat.format(new Date(selected.end - 1))}</span><span><Clock3 size={15} /> {timeFormat.format(selected.start)} – {timeFormat.format(selected.end)}</span>{selected.metadata?.city && <span><MapPin size={15} /> {selected.metadata.city}</span>}</div></div><button className="stage-fullscreen icon-button" title="Plein écran du lecteur" aria-label="Plein écran du lecteur" onClick={() => { if (!document.fullscreenElement) void stageRef.current?.requestFullscreen(); else void document.exitFullscreen() }}><Expand size={18} /></button></div>
            <div className={`video-stage ${focus ? 'has-focus' : ''}`} ref={stageRef}>
              <div className={`camera-grid ${availableCameras.length === 1 ? 'single-camera' : ''}`}>
                {availableCameras.map((camera) => <CameraTile key={`${selected.id}/${activeStart}/${camera}`} camera={camera} url={active && urls.segment === activeStart ? urls.files[camera] : undefined} offset={active ? (time - active.start) / 1000 : 0} playing={playing} muted={muted} focused={focus === camera} onFocus={() => setFocus(focus === camera ? null : camera)} videoRef={(video) => { videoRefs.current[camera] = video }} />)}
              </div>{!active && <div className="gap-indicator">Aucune vidéo à cet instant <button onClick={() => { const next = selected.segments.find((segment) => segment.start > time); if (next) seek(next.start) }}>Segment suivant <ChevronRight size={15} /></button></div>}
              {focus && <button className="focus-close icon-button" onClick={() => setFocus(null)} title="Fermer le focus" aria-label="Fermer le focus"><X size={20} /></button>}
            </div>
            <div className="playback-panel"><div className="playback-top"><span className="time-readout">{timeFormat.format(time)} <span>/ {timeFormat.format(selected.end)}</span></span><span className="clip-duration">{duration((time - selected.start) / 1000)} / {duration(totalSeconds)}</span></div>
              <div className="timeline-wrap"><input className="timeline" type="range" min={selected.start} max={selected.end - 100} step="100" value={Math.min(time, selected.end - 100)} onChange={(event) => seek(Number(event.target.value))} aria-label="Position dans l’enregistrement" style={{ '--progress': `${Math.max(0, (time - selected.start) / (selected.end - selected.start) * 100)}%` } as React.CSSProperties} />
                <div className="timeline-segments">{selected.segments.map((segment) => <span key={segment.start} style={{ left: `${(segment.start - selected.start) / (selected.end - selected.start) * 100}%`, width: `${segment.duration * 1000 / (selected.end - selected.start) * 100}%` }} />)}</div>
                {selected.metadata?.timestamp && Number.isFinite(new Date(selected.metadata.timestamp).getTime()) && <span className="event-marker" title="Déclenchement de l’événement" style={{ left: `${Math.max(0, Math.min(100, (new Date(selected.metadata.timestamp).getTime() - selected.start) / (selected.end - selected.start) * 100))}%` }} />}
              </div>
              <div className="transport"><div className="transport-side"><button className="icon-button" title="Revenir au début" aria-label="Revenir au début" onClick={() => seek(selected.start)}><RotateCcw size={17} /></button><button className="icon-button" title="Segment précédent" aria-label="Segment précédent" onClick={() => seek([...selected.segments].reverse().find((segment) => segment.start < time - 1000)?.start ?? selected.start)}><SkipBack size={18} /></button></div><div className="transport-center"><button className="play-button" onClick={() => { if (time >= selected.end - 200) seek(selected.start); setPlaying(!playing) }} title={playing ? 'Pause' : 'Lecture'} aria-label={playing ? 'Pause' : 'Lecture'}>{playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}</button></div><div className="transport-side right"><button className="icon-button" title="Segment suivant" aria-label="Segment suivant" onClick={() => seek(selected.segments.find((segment) => segment.start > time + 1000)?.start ?? selected.end - 100)}><SkipForward size={18} /></button><button className="icon-button" title={muted ? 'Activer le son' : 'Couper le son'} aria-label={muted ? 'Activer le son' : 'Couper le son'} onClick={() => setMuted(!muted)}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button></div></div>
            </div>
            <div className="details-strip"><div><span>TYPE D’ÉVÉNEMENT</span><strong>{reasonLabel(selected.metadata?.reason)}</strong></div><div><span>CAMÉRAS</span><strong>{availableCameras.length} angle{availableCameras.length > 1 ? 's' : ''} disponible{availableCameras.length > 1 ? 's' : ''}</strong></div><div><span>FICHIERS</span><strong>{selected.segments.reduce((count, segment) => count + Object.keys(segment.files).length, 0)} vidéos</strong></div></div>
          </> : <div className="welcome"><div className="welcome-visual"><div className="visual-grid"><div /><div /><div /></div><span className="visual-cross">+</span><span className="visual-tag">CAM 01 <span>● REC</span></span></div><span className="eyebrow">VOTRE ARCHIVE VIDÉO</span><h1>Chaque angle.<br /><em>Chaque instant.</em></h1><p>Ouvrez le dossier TeslaCam de votre clé USB pour parcourir vos événements et visionner toutes les caméras ensemble.</p><button className="welcome-button" onClick={() => inputRef.current?.click()}><FolderOpen size={19} /> Choisir un dossier <ChevronRight size={18} /></button><span className="welcome-footnote"><Shield size={15} /> Aucune vidéo n’est envoyée sur Internet</span></div>}
        </section>
      </div>
    </main>
  </div>
}

export default App