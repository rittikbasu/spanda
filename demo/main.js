import { createSpanda, cues, profiles } from '../dist/index.js'

const cueMetadata = {
  tap: { detail: 'pointer press' },
  type: { detail: 'repeated input' },
  toggleOn: { label: 'toggle on', detail: 'state enabled' },
  toggleOff: { label: 'toggle off', detail: 'state disabled' },
  notify: { detail: 'incoming update' },
  open: { detail: 'surface revealed' },
  close: { detail: 'surface dismissed' },
  send: { detail: 'outgoing action' },
  confirm: { detail: 'action accepted' },
  error: { detail: 'action failed' },
  complete: { detail: 'flow complete' },
}

const TAGLINE_OPTICAL_OVERLAP = 1

const sound = createSpanda({ profile: 'tactile' })
const profileRoot = document.querySelector('#profiles')
const cueRoot = document.querySelector('#cues')
const resonance = document.querySelector('#resonance')
const readout = document.querySelector('#readout')
const statusCue = document.querySelector('#status-cue')
const statusMeta = document.querySelector('#status-meta')
const profileSet = document.querySelector('.profile-set')
const install = document.querySelector('.install')
const copyInstall = document.querySelector('#copy-install')
const copyState = document.querySelector('#copy-state')
const copyAnnouncement = document.querySelector('#copy-announcement')
const installCommand = document.querySelector('.install__command code').textContent.trim()
const identity = document.querySelector('.identity')
const wordmark = identity.querySelector('h1')
const tagline = identity.querySelector('.identity__copy')
const compactLayout = window.matchMedia('(max-width: 737px)')
const tuckedTagline = window.matchMedia('(max-width: 737px), (min-width: 1000px)')
const taglineMeasureContext = document.createElement('canvas').getContext('2d')

let activeProfile = 'tactile'
let activeCueButton
let playbackTimer
let copyTimer
let taglineFrame

function metadataForCue(cue) {
  const metadata = cueMetadata[cue]
  if (!metadata) throw new Error(`missing demo metadata for cue "${cue}"`)
  return metadata
}

function updateProfileSelection() {
  for (const button of profileRoot.querySelectorAll('[data-profile]')) {
    button.setAttribute('aria-pressed', String(button.dataset.profile === activeProfile))
  }

  resonance.dataset.voice = activeProfile
}

function renderProfiles() {
  profileRoot.replaceChildren(...Object.keys(profiles).map((profile) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'profile'
    button.dataset.profile = profile
    button.textContent = profile
    button.setAttribute('aria-pressed', String(profile === activeProfile))
    button.addEventListener('click', () => {
      activeProfile = profile
      sound.setProfile(profile)
      updateProfileSelection()
      sound.play('tap')
      animatePlayback(null, 'tap', profile, true)
    })
    return button
  }))
}

function positionInstall() {
  const anchor = compactLayout.matches ? cueRoot : profileSet
  if (anchor.nextElementSibling === install) return

  const focusedElement = install.contains(document.activeElement) ? document.activeElement : null
  anchor.after(install)
  if (focusedElement instanceof HTMLElement) focusedElement.focus({ preventScroll: true })
}

function appendBaselineMarker(element) {
  const marker = document.createElement('span')
  marker.style.cssText = 'display:inline-block;width:0;height:0;padding:0;margin:0'
  element.append(marker)
  return marker
}

function alignTagline() {
  identity.style.removeProperty('--tagline-offset-x')
  identity.style.removeProperty('--tagline-offset-y')

  if (!tuckedTagline.matches) return

  identity.style.setProperty('--tagline-offset-x', '0px')
  identity.style.setProperty('--tagline-offset-y', '0px')

  const wordmarkMarker = appendBaselineMarker(wordmark)
  const taglineMarker = appendBaselineMarker(tagline)
  const wordmarkStyle = getComputedStyle(wordmark)
  taglineMeasureContext.font = `${wordmarkStyle.fontWeight} ${wordmarkStyle.fontSize} ${wordmarkStyle.fontFamily}`

  const pRange = document.createRange()
  pRange.setStart(wordmark.firstChild, 1)
  pRange.setEnd(wordmark.firstChild, 2)

  const taglineRange = document.createRange()
  taglineRange.selectNodeContents(tagline)

  const pRight = pRange.getBoundingClientRect().right
  const taglineLeft = taglineRange.getBoundingClientRect().left
  const pBottom = wordmarkMarker.getBoundingClientRect().top
    + taglineMeasureContext.measureText('p').actualBoundingBoxDescent
  const taglineBaseline = taglineMarker.getBoundingClientRect().top

  wordmarkMarker.remove()
  taglineMarker.remove()

  const taglineX = pRight - TAGLINE_OPTICAL_OVERLAP - taglineLeft
  identity.style.setProperty('--tagline-offset-x', `${taglineX.toFixed(2)}px`)
  identity.style.setProperty('--tagline-offset-y', `${(pBottom - taglineBaseline).toFixed(2)}px`)
}

function scheduleTaglineAlignment() {
  cancelAnimationFrame(taglineFrame)
  taglineFrame = requestAnimationFrame(alignTagline)
}

function startResonance(cue) {
  resonance.dataset.activeCue = cue
  resonance.classList.remove('is-playing')
  readout.classList.add('is-playing')
  void resonance.offsetWidth
  resonance.classList.add('is-playing')
}

function stopPlaybackUi() {
  clearTimeout(playbackTimer)
  activeCueButton?.classList.remove('is-playing')
  activeCueButton = undefined
  playbackTimer = undefined
  resonance.classList.remove('is-playing')
  readout.classList.remove('is-playing')
}

function animatePlayback(button, cue, status, preview = false) {
  stopPlaybackUi()

  activeCueButton = button
  button?.classList.add('is-playing')

  startResonance(cue)
  statusCue.textContent = status
  statusMeta.textContent = preview ? 'voice preview' : `${activeProfile} voice`

  playbackTimer = window.setTimeout(() => {
    stopPlaybackUi()
    if (preview) {
      statusCue.textContent = 'ready'
      statusMeta.textContent = `${status} voice`
    }
  }, Number.parseFloat(getComputedStyle(resonance).getPropertyValue('--playback-state-ms')))
}

cueRoot.replaceChildren(...Object.keys(cues).map((cue, index) => {
  const metadata = metadataForCue(cue)
  const label = metadata.label ?? cue
  const button = document.createElement('button')
  const number = document.createElement('span')
  const name = document.createElement('span')
  const intent = document.createElement('span')
  const mark = document.createElement('span')

  button.type = 'button'
  button.className = 'cue'
  button.dataset.cue = cue
  button.setAttribute('aria-label', `play ${label}: ${metadata.detail}`)

  number.className = 'cue__number'
  number.textContent = String(index + 1).padStart(2, '0')

  name.className = 'cue__name'
  name.textContent = label

  intent.className = 'cue__intent'
  intent.textContent = metadata.detail

  mark.className = 'cue__mark'
  mark.setAttribute('aria-hidden', 'true')

  button.append(number, name, intent, mark)
  button.addEventListener('click', () => {
    sound.play(cue)
    animatePlayback(button, cue, label)
  })
  return button
}))

renderProfiles()
positionInstall()
scheduleTaglineAlignment()
compactLayout.addEventListener('change', positionInstall)
tuckedTagline.addEventListener('change', scheduleTaglineAlignment)
window.addEventListener('resize', scheduleTaglineAlignment)
document.fonts?.ready.then(scheduleTaglineAlignment)

async function copyInstallCommand() {
  try {
    await navigator.clipboard.writeText(installCommand)
    return true
  } catch {
    const previousFocus = document.activeElement
    const textarea = document.createElement('textarea')
    textarea.value = installCommand
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.append(textarea)
    let copied = false
    try {
      textarea.select()
      copied = document.execCommand('copy')
    } catch {
      // The visible command remains selectable when the fallback is blocked.
    } finally {
      textarea.remove()
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
    return copied
  }
}

copyInstall.addEventListener('click', async () => {
  sound.play('tap')
  copyAnnouncement.textContent = ''

  if (await copyInstallCommand()) {
    clearTimeout(copyTimer)
    copyInstall.dataset.copied = 'true'
    copyState.textContent = 'copied'
    copyAnnouncement.textContent = 'install command copied'
    copyTimer = window.setTimeout(() => {
      delete copyInstall.dataset.copied
      copyState.textContent = 'copy'
    }, 1600)
  } else {
    copyState.textContent = 'select + copy'
    copyAnnouncement.textContent = 'copy unavailable. select the command and copy it manually'
  }
})

window.spanda = sound