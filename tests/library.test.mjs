import assert from 'node:assert/strict'
import { test } from 'node:test'
import { displayedCameraSource, eventCamera, loadLibrary, previewFrame, reasonLabel, recordingStartTime, segmentAt, thumbnailOffset } from '../src/library.ts'

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
  assert.equal(reasonLabel(event.metadata.reason, 'en'), 'Manual save')
})

test('event camera focus chooses the available lateral view or falls back to front', async () => {
  const folder = 'TeslaCam/SentryClips/2026-09-30_09-08-21/'
  const files = [
    file(folder + '2026-09-30_09-07-28-front.mp4'),
    file(folder + '2026-09-30_09-07-28-left_repeater.mp4'),
    file(folder + '2026-09-30_09-07-28-right_repeater.mp4'),
    file(folder + 'event.json', '{"camera":"5"}'),
  ]
  const [event] = await loadLibrary(files)
  assert.equal(eventCamera(event), 'right_repeater')
  event.metadata.camera = '6'
  assert.equal(eventCamera(event), 'front')
})

test('preview uses the event camera and the segment containing its timestamp', async () => {
  const folder = 'TeslaCam/SentryClips/2026-09-30_09-08-21/'
  const [event] = await loadLibrary([
    file(folder + 'event.json', '{"camera":"5","timestamp":"2026-09-30T09:07:20"}'),
    file(folder + '2026-09-30_09-06-27-front.mp4'),
    file(folder + '2026-09-30_09-06-27-right_repeater.mp4'),
    file(folder + '2026-09-30_09-07-28-front.mp4'),
  ])
  const preview = previewFrame(event)
  assert.equal(preview.camera, 'right_repeater')
  assert.equal(preview.sourceCamera, 'right_repeater')
  assert.equal(preview.file.name, '2026-09-30_09-06-27-right_repeater.mp4')
  assert.equal(preview.offset, 53)
  assert.equal(preview.timestamp, new Date('2026-09-30T09:07:20').getTime())
  assert.equal(recordingStartTime(event), preview.timestamp)
})

test('side event previews choose the opposite repeater file when available', async () => {
  const folder = 'TeslaCam/SentryClips/2026-09-30_09-08-21/'
  const [event] = await loadLibrary([
    file(folder + 'event.json', '{"camera":"5","timestamp":"2026-09-30T09:07:20"}'),
    file(folder + '2026-09-30_09-06-27-left_repeater.mp4'),
    file(folder + '2026-09-30_09-06-27-right_repeater.mp4'),
  ])
  assert.equal(previewFrame(event).camera, 'right_repeater')
  assert.equal(previewFrame(event).sourceCamera, 'left_repeater')
  event.metadata.camera = '4'
  assert.equal(previewFrame(event).camera, 'left_repeater')
  assert.equal(previewFrame(event).sourceCamera, 'right_repeater')
})

test('player and previews share lateral source mapping with missing-camera fallback', () => {
  const both = { left_repeater: file('left.mp4'), right_repeater: file('right.mp4') }
  assert.equal(displayedCameraSource('right_repeater', both), 'left_repeater')
  assert.equal(displayedCameraSource('left_repeater', both), 'right_repeater')
  assert.equal(displayedCameraSource('right_repeater', { right_repeater: both.right_repeater }), 'right_repeater')
  assert.equal(displayedCameraSource('front', both), 'front')
})

test('recordings without a usable event timestamp still open at their first clip', async () => {
  const [event] = await loadLibrary([
    file('TeslaCam/RecentClips/2026-10-01_18-23-11-front.mp4'),
  ])
  assert.equal(recordingStartTime(event), event.start)
})

test('thumbnail seeks stay away from both ends of the actual MP4', () => {
  assert.equal(thumbnailOffset(0, 60), 0.75)
  assert.equal(thumbnailOffset(53, 60), 53)
  assert.equal(thumbnailOffset(59.9, 60), 59.25)
  assert.equal(thumbnailOffset(5, 3), 2.25)
  assert.equal(thumbnailOffset(0, 1.2), 0.6)
  assert.equal(thumbnailOffset(1, 0.8), null)
  assert.equal(thumbnailOffset(1, Infinity), null)
})