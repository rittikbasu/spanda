import { createSpanda, cues, profiles } from '../dist/index.js'

const sound = createSpanda({ profile: 'tactile' })
const profileRoot = document.querySelector('#profiles')
const cueRoot = document.querySelector('#cues')
const status = document.querySelector('#status')
let activeProfile = 'tactile'

function updateProfileSelection() {
  for (const button of profileRoot.querySelectorAll('[data-profile]')) {
    button.setAttribute('aria-pressed', String(button.dataset.profile === activeProfile))
  }
}

function renderProfiles() {
  profileRoot.replaceChildren(...Object.keys(profiles).map((profile) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.profile = profile
    button.textContent = profile
    button.setAttribute('aria-pressed', String(profile === activeProfile))
    button.addEventListener('click', () => {
      activeProfile = profile
      sound.setProfile(profile)
      status.textContent = `${profile} selected`
      updateProfileSelection()
    })
    return button
  }))
}

cueRoot.replaceChildren(...Object.keys(cues).map((cue) => {
  const button = document.createElement('button')
  button.type = 'button'
  button.dataset.cue = cue
  button.textContent = cue
  button.addEventListener('click', () => {
    sound.play(cue)
    status.textContent = `${activeProfile} · ${cue}`
  })
  return button
}))

renderProfiles()
window.spanda = sound
