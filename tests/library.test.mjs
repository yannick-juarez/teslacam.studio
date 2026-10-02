import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadLibrary, reasonLabel, segmentAt } from '../src/library.ts'

function file(path, content = '') {
  return { name: path.split('/').at(-1), webkitRelativePath: path, text: async () => content }
}

test('groups Tesla event segments chronologically and reads event metadata', async () => {
  const folder = 'TeslaCam/SentryClips/2026-09-30_09-08-21/'
  const files = [
    file(folder + '2026-09-30_09-02-24-front.mp4'),
    file(folder + '2026-09-30_08-57-21-left_repeater.mp4'),
    file(folder + '2026-09-30_08-57-21-front.mp4'),
    file(folder + 'event.json', '{"reason":"sentry_aware_object_detection","city":"Saint-Alban-Leysse"}'),
  ]
  const [event] = await loadLibrary(files)
  assert.equal(event.category, 'SentryClips')
  assert.equal(event.segments.length, 2)
  assert.equal(event.metadata.city, 'Saint-Alban-Leysse')
  assert.equal(event.segments[0].files.front.name, '2026-09-30_08-57-21-front.mp4')
  assert.equal(segmentAt(event, event.start + 61000), undefined)
})

test('recent clips group by day and malformed event JSON does not discard videos', async () => {
  const recordings = await loadLibrary([
    file('TeslaCam/RecentClips/2026-10-01_18-23-11-front.mp4'),
    file('TeslaCam/RecentClips/2026-10-01_18-24-11-right_repeater.mp4'),
    file('TeslaCam/RecentClips/2026-09-30_18-23-11-front.mp4'),
    file('TeslaCam/SavedClips/2026-09-29_19-05-20/event.json', '{bad'),
    file('TeslaCam/SavedClips/2026-09-29_19-05-20/2026-09-29_19-00-37-front.mp4'),
  ])
  assert.equal(recordings.length, 3)
  assert.equal(recordings[0].segments.length, 2)
  assert.equal(recordings[2].metadata, undefined)
})

test('an event folder selected directly can be identified as Sentry from its JSON', async () => {
  const folder = '2026-09-30_09-08-21/'
  const [event] = await loadLibrary([
    file(folder + 'event.json', '{"reason":"sentry_aware_object_detection"}'),
    file(folder + '2026-09-30_09-07-28-front.mp4'),
  ])
  assert.equal(event.category, 'SentryClips')
})

test('dashcam icon tap is displayed as a manual save', async () => {
  const folder = 'TeslaCam/SavedClips/2026-09-29_19-05-20/'
  const [event] = await loadLibrary([
    file(folder + 'event.json', '{"reason":"user_interaction_dashcam_icon_tapped","timestamp":"2026-09-29T19:05:19"}'),
    file(folder + '2026-09-29_19-05-14-front.mp4'),
  ])
  assert.equal(event.category, 'SavedClips')
  assert.equal(reasonLabel(event.metadata.reason), 'Sauvegarde manuelle')
})