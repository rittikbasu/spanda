import assert from 'node:assert/strict'
import test from 'node:test'

import { createSpanda, cues, profiles } from '../dist/index.js'

class AudioParamStub {
  #value = 0
  #onValue

  constructor(onValue) {
    this.#onValue = onValue
  }

  get value() {
    return this.#value
  }

  set value(value) {
    this.#value = value
    this.#onValue?.(value)
  }

  setValueAtTime(value) {
    this.value = value
  }

  linearRampToValueAtTime(value) {
    this.#value = value
  }

  exponentialRampToValueAtTime(value) {
    this.#value = value
  }
}

class AudioNodeStub {
  constructor(name = 'node', counts) {
    this.name = name
    this.counts = counts
  }

  connect(destination) {
    this.counts?.connections.push([this.name, destination.name])
    return destination
  }

  disconnect() {}
}

function installAudioContext(counts, options = {}) {
  class AudioContextStub {
    state = options.state ?? 'running'
    currentTime = 1
    sampleRate = 48_000
    destination = new AudioNodeStub('destination', counts)
    gainCount = 0
    filterCount = 0

    constructor() {
      counts.contexts += 1
    }

    resume() {
      const result = options.resume?.() ?? Promise.resolve()
      return Promise.resolve(result).then(() => {
        this.state = 'running'
      })
    }

    suspend() {
      const result = options.suspend?.() ?? Promise.resolve()
      counts.suspends += 1
      return Promise.resolve(result).then(() => {
        this.state = 'suspended'
      })
    }

    close() {
      counts.closes += 1
      const result = options.close?.() ?? Promise.resolve()
      return Promise.resolve(result).then(() => {
        this.state = 'closed'
      })
    }

    createGain() {
      this.gainCount += 1
      const name = this.gainCount === 1 ? 'master' : 'gain'
      return Object.assign(new AudioNodeStub(name, counts), { gain: new AudioParamStub() })
    }

    createOscillator() {
      return Object.assign(new AudioNodeStub(), {
        type: 'sine',
        frequency: new AudioParamStub((value) => counts.frequencies.push(value)),
        setPeriodicWave: () => {},
        addEventListener: () => {},
        start: () => { counts.sources += 1 },
        stop: () => {},
      })
    }

    createBuffer(_channels, length) {
      return { getChannelData: () => new Float32Array(length) }
    }

    createBufferSource() {
      return Object.assign(new AudioNodeStub(), {
        buffer: null,
        addEventListener: () => {},
        start: () => { counts.sources += 1 },
        stop: () => {},
      })
    }

    createBiquadFilter() {
      this.filterCount += 1
      const name = this.filterCount === 1 ? 'reverbFilter' : 'filter'
      return Object.assign(new AudioNodeStub(name, counts), {
        type: 'lowpass',
        frequency: new AudioParamStub(),
        Q: new AudioParamStub(),
      })
    }

    createDynamicsCompressor() {
      if (options.failGraphSetup) throw new Error('graph setup failed')
      counts.compressors += 1
      return new AudioNodeStub('compressor', counts)
    }

    createConvolver() {
      counts.convolvers += 1
      return Object.assign(new AudioNodeStub('reverb', counts), { buffer: null })
    }

    createPeriodicWave() {
      return {}
    }

    createStereoPanner() {
      return Object.assign(new AudioNodeStub(), { pan: new AudioParamStub() })
    }
  }

  globalThis.AudioContext = AudioContextStub
}

function createCounts() {
  return {
    contexts: 0,
    sources: 0,
    suspends: 0,
    closes: 0,
    compressors: 0,
    convolvers: 0,
    frequencies: [],
    connections: [],
  }
}

test('exports the small built-in sound palette', () => {
  assert.equal(typeof createSpanda, 'function')
  assert.deepEqual(Object.keys(profiles), ['tactile', 'crisp', 'lush'])
  assert.deepEqual(Object.keys(cues), [
    'tap',
    'type',
    'toggleOn',
    'toggleOff',
    'notify',
    'open',
    'close',
    'send',
    'confirm',
    'error',
    'complete',
  ])
})

test('keeps built-in profiles deeply immutable', () => {
  assert.equal(Object.isFrozen(profiles), true)
  assert.equal(Object.isFrozen(profiles.tactile), true)
  assert.equal(Object.isFrozen(profiles.tactile.transient), true)
  assert.throws(() => {
    profiles.tactile.baseFrequency = 999
  }, TypeError)
})

test('lazily renders crisp cues through one shared graph', () => {
  const counts = createCounts()
  const originalAudioContext = globalThis.AudioContext
  const originalRandom = Math.random
  installAudioContext(counts)
  Math.random = () => 0.5

  try {
    const sound = createSpanda({ profile: 'crisp' })

    assert.equal(counts.contexts, 0)
    sound.play('type')
    sound.play('confirm')

    assert.equal(counts.contexts, 1)
    assert.equal(counts.compressors, 1)
    assert.equal(counts.convolvers, 1)
    assert.ok(counts.connections.some(([from, to]) => from === 'reverbFilter' && to === 'master'))
    assert.equal(counts.sources, 15)
    assert.deepEqual(
      counts.frequencies.slice(0, 3).map((frequency) => Number(frequency.toFixed(2))),
      [220.8, 3_312, 540],
    )
  } finally {
    Math.random = originalRandom
    if (originalAudioContext) globalThis.AudioContext = originalAudioContext
    else delete globalThis.AudioContext
  }
})

test('uses a per-play profile without changing the instance default', () => {
  const counts = createCounts()
  const originalAudioContext = globalThis.AudioContext
  const originalRandom = Math.random
  installAudioContext(counts)
  Math.random = () => 0.5

  try {
    const sound = createSpanda({ profile: 'tactile' })

    sound.play('type', { profile: 'crisp' })

    assert.equal(sound.profile, profiles.tactile)
    assert.deepEqual(
      counts.frequencies.slice(0, 3).map((frequency) => Number(frequency.toFixed(2))),
      [220.8, 3_312, 540],
    )
  } finally {
    Math.random = originalRandom
    if (originalAudioContext) globalThis.AudioContext = originalAudioContext
    else delete globalThis.AudioContext
  }
})

test('voices full completion for each built-in profile', () => {
  const counts = createCounts()
  const originalAudioContext = globalThis.AudioContext
  const originalRandom = Math.random
  installAudioContext(counts)
  Math.random = () => 0.5

  try {
    const sound = createSpanda({ profile: 'tactile' })

    sound.play('complete')
    sound.setProfile('crisp')
    sound.play('complete')
    sound.setProfile('lush')
    sound.play('complete')

    assert.equal(counts.sources, 24)
    assert.deepEqual(counts.frequencies.map((frequency) => Number(frequency.toFixed(2))), [
      118, 59, 236, 295, 354, 590,
      159.3, 79.65, 318.6, 398.25, 477.9, 796.5,
      103.84, 51.92, 207.68, 259.6, 311.52, 519.2,
    ])
  } finally {
    Math.random = originalRandom
    if (originalAudioContext) globalThis.AudioContext = originalAudioContext
    else delete globalThis.AudioContext
  }
})

test('preserves completion voicing when a built-in profile is copied', () => {
  const counts = createCounts()
  const originalAudioContext = globalThis.AudioContext
  const originalRandom = Math.random
  installAudioContext(counts)
  Math.random = () => 0.5

  try {
    const sound = createSpanda({ profile: { ...profiles.crisp } })

    sound.play('complete')

    assert.deepEqual(counts.frequencies.map((frequency) => Number(frequency.toFixed(2))), [
      159.3, 79.65, 318.6, 398.25, 477.9, 796.5,
    ])
  } finally {
    Math.random = originalRandom
    if (originalAudioContext) globalThis.AudioContext = originalAudioContext
    else delete globalThis.AudioContext
  }
})

test('uses an exact discriminator for the completion cue', () => {
  const counts = createCounts()
  const originalAudioContext = globalThis.AudioContext
  const originalRandom = Math.random
  installAudioContext(counts)
  Math.random = () => 0.5

  try {
    const sound = createSpanda()
    const customCue = {
      kind: 'metadata',
      hits: [{ pitch: 1, gain: 0.42, glide: 1 }],
      decay: 0.8,
      reverb: 0.35,
      transient: 0.3,
      sub: 0.12,
    }

    sound.play(customCue)

    assert.equal(counts.sources, 3)
  } finally {
    Math.random = originalRandom
    if (originalAudioContext) globalThis.AudioContext = originalAudioContext
    else delete globalThis.AudioContext
  }
})

test('fails closed when a browser throws or sound is disabled during resume', async () => {
  const counts = createCounts()
  const originalAudioContext = globalThis.AudioContext
  installAudioContext(counts, {
    state: 'suspended',
    resume: () => { throw new Error('resume blocked') },
  })

  try {
    const sound = createSpanda()

    assert.doesNotThrow(() => sound.play('tap'))
    assert.equal(counts.sources, 0)

    installAudioContext(counts, {
      suspend: () => { throw new Error('suspend blocked') },
    })
    const secondSound = createSpanda()
    secondSound.play('tap')
    assert.doesNotThrow(() => secondSound.setEnabled(false))

    let finishResume
    installAudioContext(counts, {
      state: 'suspended',
      resume: () => new Promise((resolve) => { finishResume = resolve }),
    })
    const pendingSound = createSpanda()
    const sourcesBeforeResume = counts.sources
    pendingSound.play('tap')
    pendingSound.setEnabled(false)
    finishResume()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(counts.sources, sourcesBeforeResume)
  } finally {
    if (originalAudioContext) globalThis.AudioContext = originalAudioContext
    else delete globalThis.AudioContext
  }
})

test('closes the owned context when graph setup fails', () => {
  const counts = createCounts()
  const originalAudioContext = globalThis.AudioContext
  installAudioContext(counts, { failGraphSetup: true })

  try {
    const sound = createSpanda()

    assert.doesNotThrow(() => sound.play('tap'))
    assert.equal(counts.contexts, 1)
    assert.equal(counts.closes, 1)
  } finally {
    if (originalAudioContext) globalThis.AudioContext = originalAudioContext
    else delete globalThis.AudioContext
  }
})

test('keeps a disabled context suspended after explicit resume settles', async () => {
  const counts = createCounts()
  const originalAudioContext = globalThis.AudioContext
  let finishResume
  installAudioContext(counts, {
    state: 'suspended',
    resume: () => new Promise((resolve) => { finishResume = resolve }),
  })

  try {
    const sound = createSpanda()
    const resumed = sound.resume()

    sound.setEnabled(false)
    finishResume()
    await resumed
    await Promise.resolve()

    assert.equal(sound.enabled, false)
    assert.equal(counts.suspends, 1)
  } finally {
    if (originalAudioContext) globalThis.AudioContext = originalAudioContext
    else delete globalThis.AudioContext
  }
})

test('retries teardown when destroy races a pending resume', async () => {
  const counts = createCounts()
  const originalAudioContext = globalThis.AudioContext
  let finishResume
  let closeAttempts = 0
  installAudioContext(counts, {
    state: 'suspended',
    resume: () => new Promise((resolve) => { finishResume = resolve }),
    close: () => {
      closeAttempts += 1
      return closeAttempts === 1
        ? Promise.reject(new Error('close blocked while resuming'))
        : Promise.resolve()
    },
  })

  try {
    const sound = createSpanda()

    sound.play('tap')
    await sound.destroy()
    finishResume()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    assert.equal(counts.sources, 0)
    assert.equal(counts.closes, 2)
  } finally {
    if (originalAudioContext) globalThis.AudioContext = originalAudioContext
    else delete globalThis.AudioContext
  }
})

test('supports custom profiles and recipes with an owned lifecycle', async () => {
  const counts = createCounts()
  const originalAudioContext = globalThis.AudioContext
  installAudioContext(counts)

  const customProfile = {
    ...profiles.tactile,
    baseFrequency: 200,
    transient: { ...profiles.tactile.transient, amount: 0 },
    sub: 0,
    click: 0,
    ping: 0,
    pitchVariationPercent: 0,
    volumeVariationPercent: 0,
    reverb: 0,
  }
  const customCue = {
    hits: [{ pitch: 2, gain: 1, glide: 1 }],
    decay: 1,
    reverb: 0,
    transient: 0,
    sub: 0,
  }

  try {
    const sound = createSpanda({ profile: customProfile, volume: 2 })

    assert.equal(sound.volume, 1)
    assert.doesNotThrow(() => sound.setVolume(Number.NaN))
    assert.equal(sound.volume, 0)
    sound.play(customCue)
    assert.equal(counts.sources, 1)
    assert.deepEqual(counts.frequencies, [400])

    sound.setEnabled(false)
    sound.play(customCue)
    assert.equal(counts.suspends, 1)
    assert.equal(counts.sources, 1)

    sound.setEnabled(true)
    sound.play(customCue)
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(counts.contexts, 1)
    assert.equal(counts.sources, 2)

    await sound.destroy()
    sound.play(customCue)
    assert.equal(counts.closes, 1)
    assert.equal(counts.sources, 2)
  } finally {
    if (originalAudioContext) globalThis.AudioContext = originalAudioContext
    else delete globalThis.AudioContext
  }
})
