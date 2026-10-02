export const cameras = ['front', 'left_repeater', 'right_repeater', 'back', 'left_pillar', 'right_pillar'] as const
export type Camera = (typeof cameras)[number]
export type Category = 'SentryClips' | 'SavedClips' | 'RecentClips'

export interface EventMetadata {
  timestamp?: string
  city?: string
  reason?: string
  camera?: string
  est_lat?: string
  est_lon?: string
}

export interface Segment {
  start: number
  duration: number
  files: Partial<Record<Camera, File>>
}

export interface Recording {
  id: string
  category: Category
  start: number
  end: number
  segments: Segment[]
  metadata?: EventMetadata
}

const categories: Category[] = ['SentryClips', 'SavedClips', 'RecentClips']
const videoPattern = /^(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})-(front|left_repeater|right_repeater|back|left_pillar|right_pillar)\.mp4$/i

export function parseTimestamp(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return NaN
  const [, year, month, day, hour, minute, second] = match.map(Number)
  const date = new Date(year, month - 1, day, hour, minute, second)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date.getTime()
    : NaN
}

export async function loadLibrary(files: Iterable<File>): Promise<Recording[]> {
  const groups = new Map<string, { category: Category; explicitCategory: boolean; segments: Map<number, Segment>; metadata?: File }>()

  for (const file of files) {
    const path = (file.webkitRelativePath || file.name).split('/').filter(Boolean)
    const categoryIndex = path.findIndex((part) => categories.includes(part as Category))
    const category = categoryIndex >= 0 ? path[categoryIndex] as Category : 'SavedClips'
    const filename = path.at(-1) || ''
    const video = videoPattern.exec(filename)
    if (!video && filename !== 'event.json') continue

    const stamp = video ? `${video[1]}_${video[2]}` : ''
    const timestamp = video ? parseTimestamp(stamp) : NaN
    if (video && !Number.isFinite(timestamp)) continue
    const folder = path.slice(categoryIndex + 1, -1).join('/')
    const groupName = category === 'RecentClips' ? `recent/${video?.[1] || folder}` : folder || stamp
    const id = `${category}/${groupName}`
    let group = groups.get(id)
    if (!group) {
      group = { category, explicitCategory: categoryIndex >= 0, segments: new Map() }
      groups.set(id, group)
    }
    if (filename === 'event.json') {
      group.metadata = file
    } else if (video) {
      let segment = group.segments.get(timestamp)
      if (!segment) {
        segment = { start: timestamp, duration: 60, files: {} }
        group.segments.set(timestamp, segment)
      }
      segment.files[video[3].toLowerCase() as Camera] = file
    }
  }

  const recordings: (Recording | null)[] = await Promise.all([...groups].map(async ([id, group]) => {
    const segments = [...group.segments.values()].sort((a, b) => a.start - b.start)
    if (!segments.length) return null
    for (let index = 0; index < segments.length - 1; index++) {
      const delta = (segments[index + 1].start - segments[index].start) / 1000
      if (delta <= 75) segments[index].duration = delta
    }
    let metadata: EventMetadata | undefined
    if (group.metadata) {
      try {
        const parsed: unknown = JSON.parse(await group.metadata.text())
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const value = parsed as Record<string, unknown>
          metadata = Object.fromEntries(
            ['timestamp', 'city', 'reason', 'camera', 'est_lat', 'est_lon']
              .filter((key) => typeof value[key] === 'string')
              .map((key) => [key, value[key]]),
          ) as EventMetadata
        }
      } catch { /* Ignore invalid metadata. */ }
    }
    const category = !group.explicitCategory && metadata?.reason?.startsWith('sentry_')
      ? 'SentryClips' : group.category
    return {
      id: category === group.category ? id : id.replace(/^SavedClips\//, `${category}/`),
      category, metadata, segments,
      start: segments[0].start,
      end: segments.at(-1)!.start + segments.at(-1)!.duration * 1000,
    } satisfies Recording
  }))

  return recordings.filter((recording): recording is Recording => recording !== null)
    .sort((a, b) => b.end - a.end)
}

export function segmentAt(recording: Recording, time: number): Segment | undefined {
  return recording.segments.find((segment) => time >= segment.start && time < segment.start + segment.duration * 1000)
}

export function reasonLabel(reason?: string): string {
  const labels: Record<string, string> = {
    sentry_aware_object_detection: 'Objet détecté',
    sentry_aware_accel: 'Mouvement détecté',
    sentry_aware_user_interaction: 'Interaction détectée',
    sentry_aware_proximity: 'Proximité détectée',
    sentry_aware_alarm: 'Alarme déclenchée',
    user_interaction_dashcam: 'Sauvegarde manuelle',
    user_interaction_dashcam_icon_tapped: 'Sauvegarde manuelle',
    honk: 'Klaxon',
  }
  return reason ? labels[reason] || reason.replaceAll('_', ' ') : 'Enregistrement'
}