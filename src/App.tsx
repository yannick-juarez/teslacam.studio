import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpLeft, ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Clock3, Expand, FolderOpen, Grid2X2, HardDrive, MapPin, Moon, Pause, PictureInPicture2, Play, RotateCcw, ScanEye, Shield, SkipBack, SkipForward, Sun, Volume2, VolumeX, X } from 'lucide-react'
import { cameras, displayedCameraSource, eventCamera, loadLibrary, previewFrame, reasonLabel, recordingStartTime, segmentAt, thumbnailOffset, type Camera, type Category, type Recording } from './library'
import appIcon from './assets/icon.png'
import './App.css'

const cameraNames: Record<Camera, string> = {
  front: 'Avant', left_repeater: 'Répétiteur gauche', right_repeater: 'Répétiteur droit',
  back: 'Arrière', left_pillar: 'Montant gauche', right_pillar: 'Montant droit',
}
const cameraIcons: Record<Camera, React.ReactNode> = {
  front: <ArrowUp size={19} />, back: <ArrowDown size={19} />,
  left_repeater: <ArrowUpLeft size={19} />, right_repeater: <ArrowUpRight size={19} />,
  left_pillar: <ArrowUpLeft size={19} />, right_pillar: <ArrowUpRight size={19} />,
}
const categoryNames: Record<Category, string> = {
  SentryClips: 'Sentinelle', SavedClips: 'Sauvegardés', RecentClips: 'Récents',
}
type Layout = 'grid' | 'mirrors' | 'event'
const dateFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const shortDateFormat = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' })

function duration(seconds: number) {
  const value = Math.max(0, Math.floor(seconds))
  return `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`
}

function CameraTile({ camera, url, offset, playing, muted, focused, eventMarked, position, onFocus, videoRef }: {
  camera: Camera; url?: string; offset: number; playing: boolean; muted: boolean
  focused: boolean; eventMarked: boolean; position: 'primary' | 'left' | 'right'; onFocus: () => void; videoRef: (element: HTMLVideoElement | null) => void
}) {
  const [failed, setFailed] = useState(false)
  const [aspectRatio, setAspectRatio] = useState('4 / 3')

  return <div className={`camera-tile camera-${camera} position-${position} ${focused ? 'camera-focused' : ''} ${eventMarked ? 'event-highlight' : ''}`} style={{ '--video-ratio': aspectRatio } as React.CSSProperties}>
    {url && !failed ? <video
      ref={videoRef} src={url} muted={muted} playsInline preload="metadata"
      onLoadedMetadata={(event) => {
        const video = event.currentTarget
        if (video.videoWidth && video.videoHeight) setAspectRatio(`${video.videoWidth} / ${video.videoHeight}`)
        video.currentTime = Math.min(offset, Math.max(0, video.duration - 0.1))
        if (playing) void video.play().catch(() => {})
      }}
      onError={() => setFailed(true)}
    /> : <div className="camera-empty"><span>{failed ? 'Vidéo non prise en charge par ce navigateur' : 'Aucun enregistrement'}</span></div>}
    <span className={`camera-direction direction-${camera}`} aria-hidden="true">{cameraIcons[camera]}</span>
    {eventMarked && <span className="event-camera-icon" title="Caméra de l’événement" role="img" aria-label="Caméra de l’événement"><ScanEye size={18} /></span>}
    {url && !failed && <button className="camera-hitarea" onClick={onFocus} title={focused ? `Quitter le focus ${cameraNames[camera]}` : `${cameraNames[camera]} · Agrandir`} aria-label={focused ? `Quitter le focus ${cameraNames[camera]}` : `Agrandir ${cameraNames[camera]}`} />}
  </div>
}

function ClipThumbnail({ recording, eager }: { recording: Recording; eager: boolean }) {
  const previewRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const seekOffsetRef = useRef<number | null>(null)
  const [activated, setActivated] = useState(false)
  const [readyFile, setReadyFile] = useState<File | null>(null)
  const [previewTime, setPreviewTime] = useState(0)
  const frame = previewFrame(recording)
  const { file, camera, offset, timestamp } = frame

  useEffect(() => {
    if (eager || !previewRef.current) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setActivated(true); observer.disconnect() }
    })
    observer.observe(previewRef.current)
    return () => observer.disconnect()
  }, [eager])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !(eager || activated)) return
    const url = URL.createObjectURL(file)
    video.src = url
    return () => {
      video.removeAttribute('src')
      video.load()
      URL.revokeObjectURL(url)
    }
  }, [file, eager, activated])

  function showFrame(video: HTMLVideoElement) {
    const target = seekOffsetRef.current
    if (target === null || video.seeking || video.readyState < 2 || !video.videoWidth || Math.abs(video.currentTime - target) > 0.15) return
    setPreviewTime(timestamp + (video.currentTime - offset) * 1000)
    setReadyFile(file)
  }

  return <div className="clip-preview" ref={previewRef}>
    <span className="clip-preview-placeholder" aria-hidden="true">{cameraIcons[camera]}</span>
    <video ref={videoRef} className={readyFile === file ? 'ready' : ''} muted playsInline preload="metadata" aria-hidden="true"
      onLoadedMetadata={(event) => {
        const safeOffset = thumbnailOffset(offset, event.currentTarget.duration)
        if (safeOffset === null) return
        seekOffsetRef.current = safeOffset
        event.currentTarget.currentTime = safeOffset
      }}
      onSeeked={(event) => showFrame(event.currentTarget)}
      onLoadedData={(event) => showFrame(event.currentTarget)}
    />
    <span className="clip-preview-camera">{cameraIcons[camera]} {cameraNames[camera]}</span>
    <span className="clip-preview-time">{timeFormat.format(readyFile === file ? previewTime : timestamp)}</span>
  </div>
}

function ClipExplorer({ recordings, onOpen, onChooseFolder }: { recordings: Recording[]; onOpen: (recording: Recording) => void; onChooseFolder: () => void }) {
  return <section className="explorer-panel">
    {recordings.length ? <div className="clips-grid">{recordings.map((recording, index) => <button key={recording.id} className="clip-card" onClick={() => onOpen(recording)}><ClipThumbnail recording={recording} eager={index < 4} /><span className="clip-card-body"><strong>{recording.category === 'RecentClips' ? 'Enregistrements récents' : reasonLabel(recording.metadata?.reason)}</strong><span>{dateFormat.format(recording.end - 1)}</span><small>{recording.metadata?.city || categoryNames[recording.category]} · {duration((recording.end - recording.start) / 1000)}</small></span></button>)}</div> : <div className="explorer-empty-state"><FolderOpen size={28} /><h2>Aucun clip à afficher</h2><p>Choisissez un dossier TeslaCam pour parcourir vos enregistrements.</p><button className="welcome-button" onClick={onChooseFolder}><FolderOpen size={17} /> Choisir un dossier</button></div>}
  </section>
}

function WelcomeScreen({ onChooseFolder, loading }: { onChooseFolder: () => void; loading: boolean }) {
  return <div className="welcome-page">
    <section className="welcome-intro" aria-labelledby="welcome-title">
      <span className="welcome-glyph"><FolderOpen size={30} strokeWidth={1.5} /></span>
      <h2 id="welcome-title">Aucun dossier sélectionné</h2>
      <p>Branchez la clé USB de votre Tesla et sélectionnez son dossier TeslaCam pour parcourir vos clips.</p>
      <button className="welcome-button" onClick={onChooseFolder} disabled={loading}><FolderOpen size={18} /> {loading ? 'Lecture du dossier…' : 'Sélectionner le dossier TeslaCam'}</button>
      <p className="welcome-privacy">Les vidéos restent sur votre appareil. Aucune connexion à votre voiture ni transfert vers un serveur.</p>
    </section>
    <section className="welcome-information" aria-labelledby="questions-title">
      <div className="welcome-overview"><h2>Visionnez vos vidéos TeslaCam sur clé USB</h2><p>Retrouvez vos enregistrements Dashcam et mode Sentinelle dans le navigateur, avec les dates, le type d'événement et les caméras synchronisées. Une alternative pour revoir les vidéos lorsque Live Camera à distance n'est pas disponible, par exemple sur certains véhicules MCU1 ou sans Connectivité Premium.</p></div>
      <h2 id="questions-title">Questions fréquentes</h2>
      <div><article><h3>Faut-il la Connectivité Premium ?</h3><p>Non. Ce lecteur ouvre les fichiers déjà enregistrés sur votre clé USB. Il ne nécessite pas l'accès à Live Camera.</p></article><article><h3>Est-ce adapté à une Tesla MCU1 ?</h3><p>Oui, si votre véhicule enregistre des vidéos TeslaCam sur clé USB. Le lecteur ne dépend pas de la visualisation à distance depuis l'application Tesla.</p></article><article><h3>Puis-je voir ma Tesla à distance ?</h3><p>Non. Cette application lit uniquement les clips présents sur la clé branchée à votre ordinateur ; elle n'active pas l'accès aux caméras en direct.</p></article></div>
    </section>
    <section className="welcome-english" lang="en"><h2>Tesla USB Sentry browser</h2><p>Browse Tesla Sentry Mode and Dashcam recordings from your USB drive in a browser. Select the TeslaCam folder to review saved events and synchronized camera views locally, including on vehicles where remote Live Camera viewing is unavailable, such as some MCU1 configurations or without Premium Connectivity. This viewer does not enable remote access to the car.</p></section>
  </div>
}

function App() {
  const inputRef = useRef<HTMLInputElement>(null)
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
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('teslacam-theme') === 'dark')
  const [layout, setLayout] = useState<Layout>('mirrors')
  const [view, setView] = useState<'player' | 'explorer'>('explorer')

  const filtered = recordings.filter((recording) =>
    (category === 'all' || recording.category === category) &&
    (!date || new Date(recording.end - 1).toLocaleDateString('sv-SE') === date))
  const selected = recordings.find((recording) => recording.id === selectedId)
  const active = selected ? segmentAt(selected, time) : undefined
  const activeStart = active?.start
  const activeFiles = active?.files
  const totalSeconds = selected ? (selected.end - selected.start) / 1000 : 0
  const cameraOrder: Camera[] = ['front', 'right_repeater', 'left_repeater', 'back', 'right_pillar', 'left_pillar']
  const availableCameras = selected ? cameraOrder.filter((camera) => selected.segments.some((segment) => segment.files[camera])) : []
  const eventCameraId = selected?.metadata?.camera && ['0', '4', '5', ...cameras].includes(selected.metadata.camera)
    ? eventCamera(selected) : null
  const primaryCamera = layout === 'event' && selected ? eventCamera(selected) :
    (availableCameras.includes('front') ? 'front' : availableCameras[0])
  const overlayOrder: Camera[] = ['left_repeater', 'right_repeater', 'front', 'back', 'left_pillar', 'right_pillar']
  const overlays = overlayOrder.filter((camera) => camera !== primaryCamera && availableCameras.includes(camera)).slice(0, 2)
  const visibleCameras = layout === 'grid' ? availableCameras : primaryCamera ? [primaryCamera, ...overlays] : []

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
      setSelectedId('')
      setTime(0)
      playbackTimeRef.current = 0
      setView('explorer')
      setSourceName(files[0].webkitRelativePath.split('/')[0] || 'Dossier sélectionné')
    } catch {
      setMessage('Impossible de lire ce dossier. Vérifiez l’accès aux fichiers et réessayez.')
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function selectRecording(recording: Recording) {
    const initialTime = recordingStartTime(recording)
    setSelectedId(recording.id)
    setTime(initialTime)
    playbackTimeRef.current = initialTime
    setPlaying(false)
    setFocus(null)
    setView('player')
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

  const handleShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === 'Escape') { setFocus(null); return }
    const target = event.target as HTMLElement
    if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing ||
      target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || view !== 'player' || !selected) return

    if (event.key.toLowerCase() === 'k' || (event.code === 'Space' && target.tagName !== 'BUTTON')) {
      event.preventDefault()
      setPlaying((value) => !value)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      seek(time + (event.key === 'ArrowRight' ? 5000 : -5000))
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const index = filtered.findIndex((recording) => recording.id === selectedId)
      const next = filtered[index + (event.key === 'ArrowDown' ? 1 : -1)]
      if (next) { event.preventDefault(); selectRecording(next) }
    }
  })

  useEffect(() => {
    if (!activeFiles || activeStart === undefined) { videoRefs.current = {}; return }
    const next: Partial<Record<Camera, string>> = {}
    for (const camera of cameras) {
      const file = activeFiles[displayedCameraSource(camera, activeFiles)]
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
      handleShortcut(event)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const grouped = filtered.reduce<Record<string, Recording[]>>((days, recording) => {
    const day = new Date(recording.end - 1).toLocaleDateString('sv-SE')
    ;(days[day] ||= []).push(recording)
    return days
  }, {})

  return <div className={`app-shell ${darkMode ? 'theme-dark' : ''} ${recordings.length ? '' : 'is-welcome'}`}>
    <aside className="sidebar">
      <div className="brand"><img src={appIcon} alt="" width="16" height="16" /><strong>TeslaCam</strong><span>Studio</span></div>
      {!recordings.length && <div className="sidebar-onboarding">
        <div className="source-box"><div className="source-icon"><HardDrive size={19} /></div><div className="source-copy"><span>Dossier</span><strong>Aucun dossier ouvert</strong></div></div>
        <button className="open-button" onClick={() => inputRef.current?.click()} disabled={loading}><FolderOpen size={18} /> {loading ? 'Lecture du dossier…' : 'Ouvrir un dossier'}</button>
        <h2>Pour commencer</h2>
        <ol><li><span>01</span><div><strong>Branchez la clé USB</strong><p>Insérez la clé utilisée pour TeslaCam dans votre ordinateur.</p></div></li><li><span>02</span><div><strong>Choisissez TeslaCam</strong><p>Sélectionnez le dossier TeslaCam, ou un dossier de clips.</p></div></li><li><span>03</span><div><strong>Parcourez les vidéos</strong><p>Retrouvez les événements et les vues caméra synchronisées.</p></div></li></ol>
      </div>}
      {!!recordings.length && <>
      <div className="source-box"><div className="source-icon"><HardDrive size={19} /></div><div className="source-copy"><span>Dossier</span><strong title={sourceName}>{sourceName}</strong></div><span className={`source-dot ${recordings.length ? 'connected' : ''}`} /></div>
      <button className="open-button" onClick={() => inputRef.current?.click()} disabled={loading}><FolderOpen size={18} /> {loading ? 'Lecture du dossier…' : recordings.length ? 'Changer de dossier' : 'Ouvrir un dossier'}</button>

      <div className="sidebar-heading"><span>Bibliothèque</span><span>{recordings.length}</span></div>
      <div className="category-list">
        {([['all', 'Tous les clips'], ['SentryClips', 'Sentinelle'], ['SavedClips', 'Sauvegardés'], ['RecentClips', 'Récents']] as const).map(([value, label]) =>
          <button key={value} className={`category-button ${category === value ? 'active' : ''}`} onClick={() => setCategory(value)}><span>{value === 'SentryClips' ? <Shield size={17} /> : value === 'all' ? <Expand size={17} /> : <FolderOpen size={17} />}{label}</span><small>{value === 'all' ? recordings.length : recordings.filter((item) => item.category === value).length}</small></button>)}
      </div>

      <div className="sidebar-heading date-heading"><span>Date</span>{date && <button onClick={() => setDate('')} title="Effacer le filtre de date" aria-label="Effacer le filtre de date"><X size={15} /></button>}</div>
      <label className="date-filter"><CalendarDays size={17} /><input type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label="Filtrer par date" /></label>
      <section className="recordings-section"><div className="panel-header"><h2>Enregistrements</h2><button className="view-all" onClick={() => { setPlaying(false); setCategory('all'); setDate(''); setView('explorer') }}>Voir tout <ChevronRight size={15} /></button></div>
        <div className="event-scroll">{Object.entries(grouped).map(([day, items]) => <div className="day-group" key={day}><div className="day-label"><span>{dateFormat.format(new Date(day + 'T12:00:00'))}</span><span>{items.length}</span></div>
          {items.map((recording) => <button key={recording.id} className={`event-row ${selectedId === recording.id ? 'selected' : ''}`} onClick={() => selectRecording(recording)}><span className={`event-type ${recording.category}`}><span /></span><span className="event-details"><strong>{timeFormat.format(recording.metadata?.timestamp && Number.isFinite(Date.parse(recording.metadata.timestamp)) ? Date.parse(recording.metadata.timestamp) : recording.end)}</strong><span>{recording.category === 'RecentClips' ? 'Enregistrements récents' : reasonLabel(recording.metadata?.reason)}</span><small>{recording.metadata?.city || categoryNames[recording.category]} · {duration((recording.end - recording.start) / 1000)}</small></span><ChevronRight size={16} className="event-chevron" /></button>)}</div>)}
          {!filtered.length && <div className="empty-list">{recordings.length ? 'Aucun clip pour ce filtre.' : 'Les événements apparaîtront ici après sélection du dossier.'}</div>}</div>
      </section>
      </>}
      <input ref={inputRef} type="file" multiple {...{ webkitdirectory: '', directory: '' }} className="visually-hidden" onChange={(event) => void openFiles(event.target.files)} aria-label="Sélectionner un dossier TeslaCam" />
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="topbar-info">{view === 'explorer' ? <div className="explorer-title"><h1>Explorer les clips</h1>{filtered.length > 0 && <span>{filtered.length} enregistrement{filtered.length > 1 ? 's' : ''}</span>}</div> : selected ? <><div className="title-line"><h1>{selected.category === 'RecentClips' ? 'Enregistrements récents' : reasonLabel(selected.metadata?.reason)}</h1><span className="eyebrow"><span className={`tiny-status ${selected.category}`} /> {categoryNames[selected.category]} · {shortDateFormat.format(selected.start)}</span></div><div className="topbar-meta"><span><Clock3 size={14} /> {timeFormat.format(selected.start)} – {timeFormat.format(selected.end)}</span>{selected.metadata?.city && <span><MapPin size={14} /> {selected.metadata.city}</span>}</div></> : <h1>Lecteur</h1>}</div><div className="topbar-right">
        {view === 'explorer' && selected && <button className="back-to-player" onClick={() => setView('player')}><ChevronLeft size={16} /> Lecteur</button>}
        {view === 'player' && selected && <button className="back-to-clips" onClick={() => { setPlaying(false); setFocus(null); setView('explorer') }}><ChevronLeft size={16} /> Tous les clips</button>}
        {view === 'player' && selected && <div className="layout-switch" role="group" aria-label="Disposition des caméras"><button className={layout === 'grid' ? 'active' : ''} onClick={() => { setFocus(null); setLayout('grid') }} title="Mosaïque" aria-label="Mosaïque" aria-pressed={layout === 'grid'}><Grid2X2 size={18} /></button><button className={layout === 'mirrors' ? 'active' : ''} onClick={() => { setFocus(null); setLayout('mirrors') }} title="Avant et rétroviseurs" aria-label="Avant et rétroviseurs" aria-pressed={layout === 'mirrors'}><PictureInPicture2 size={18} /></button><button className={layout === 'event' ? 'active' : ''} onClick={() => { setFocus(null); setLayout('event') }} title="Caméra de l’événement" aria-label="Caméra de l’événement" aria-pressed={layout === 'event'}><ScanEye size={18} /></button></div>}
        <label className="setting-toggle">{darkMode ? <Moon size={16} /> : <Sun size={16} />}<span>Mode sombre</span><input type="checkbox" role="switch" checked={darkMode} onChange={(event) => { setDarkMode(event.target.checked); localStorage.setItem('teslacam-theme', event.target.checked ? 'dark' : 'light') }} aria-label="Mode sombre" /><span className="switch-track" aria-hidden="true" /></label>
      </div></header>
      {message && <div className="notice" role="alert">{message}<button onClick={() => setMessage('')} aria-label="Fermer"><X size={16} /></button></div>}
      <div className="workspace">
        {!recordings.length ? <WelcomeScreen onChooseFolder={() => inputRef.current?.click()} loading={loading} /> : view === 'explorer' ? <ClipExplorer recordings={filtered} onOpen={selectRecording} onChooseFolder={() => inputRef.current?.click()} /> : <section className="viewer-panel">
          {selected ? <>
            <div className={`video-stage mode-${layout} ${focus ? 'has-focus' : ''}`}>
              <div className={`camera-grid layout-${layout} ${visibleCameras.length === 1 ? 'single-camera' : ''}`}>
                {visibleCameras.map((camera) => <CameraTile key={`${selected.id}/${activeStart}/${camera}`} camera={camera} position={camera === primaryCamera ? 'primary' : overlays.indexOf(camera) === 0 ? 'left' : 'right'} eventMarked={camera === eventCameraId} url={active && urls.segment === activeStart ? urls.files[camera] : undefined} offset={active ? (time - active.start) / 1000 : 0} playing={playing} muted={muted} focused={focus === camera} onFocus={() => setFocus(focus === camera ? null : camera)} videoRef={(video) => { videoRefs.current[camera] = video }} />)}
              </div>{!active && <div className="gap-indicator">Aucune vidéo à cet instant <button onClick={() => { const next = selected.segments.find((segment) => segment.start > time); if (next) seek(next.start) }}>Segment suivant <ChevronRight size={15} /></button></div>}
            </div>
            <div className="playback-panel"><div className="playback-top"><span className="time-readout">{timeFormat.format(time)} <span>/ {timeFormat.format(selected.end)}</span></span><span className="clip-duration">{duration((time - selected.start) / 1000)} / {duration(totalSeconds)}</span></div>
              <div className="timeline-wrap"><input className="timeline" type="range" min={selected.start} max={selected.end - 100} step="100" value={Math.min(time, selected.end - 100)} onChange={(event) => seek(Number(event.target.value))} aria-label="Position dans l’enregistrement" style={{ '--progress': `${Math.max(0, (time - selected.start) / (selected.end - selected.start) * 100)}%` } as React.CSSProperties} />
                <div className="timeline-segments">{selected.segments.map((segment) => <span key={segment.start} style={{ left: `${(segment.start - selected.start) / (selected.end - selected.start) * 100}%`, width: `${segment.duration * 1000 / (selected.end - selected.start) * 100}%` }} />)}</div>
                {selected.metadata?.timestamp && Number.isFinite(new Date(selected.metadata.timestamp).getTime()) && <span className="event-marker" title="Déclenchement de l’événement" style={{ left: `${Math.max(0, Math.min(100, (new Date(selected.metadata.timestamp).getTime() - selected.start) / (selected.end - selected.start) * 100))}%` }} />}
              </div>
              <div className="transport"><div className="transport-side"><button className="icon-button" title="Revenir au début" aria-label="Revenir au début" onClick={() => seek(selected.start)}><RotateCcw size={17} /></button><button className="icon-button" title="Segment précédent" aria-label="Segment précédent" onClick={() => seek([...selected.segments].reverse().find((segment) => segment.start < time - 1000)?.start ?? selected.start)}><SkipBack size={18} /></button></div><div className="transport-center"><button className="play-button" onClick={() => { if (time >= selected.end - 200) seek(selected.start); setPlaying(!playing) }} title={playing ? 'Pause' : 'Lecture'} aria-label={playing ? 'Pause' : 'Lecture'}>{playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}</button></div><div className="transport-side right"><button className="icon-button" title="Segment suivant" aria-label="Segment suivant" onClick={() => seek(selected.segments.find((segment) => segment.start > time + 1000)?.start ?? selected.end - 100)}><SkipForward size={18} /></button><button className="icon-button" title={muted ? 'Activer le son' : 'Couper le son'} aria-label={muted ? 'Activer le son' : 'Couper le son'} onClick={() => setMuted(!muted)}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button></div></div>
            </div>
          </> : <div className="welcome"><div className="welcome-icon"><FolderOpen size={28} strokeWidth={1.5} /></div><h1>Aucun dossier sélectionné</h1><p>Choisissez le dossier TeslaCam de votre clé USB.</p><button className="welcome-button" onClick={() => inputRef.current?.click()}><FolderOpen size={18} /> Choisir un dossier</button></div>}
        </section>}
      </div>
    </main>
  </div>
}

export default App