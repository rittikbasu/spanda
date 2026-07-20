# spanda

procedural interface sounds for the web.

spanda synthesizes a small set of tactile ui cues with the Web Audio API. there are no audio files, framework adapters, runtime dependencies, or background work before playback.

## install

```sh
npm install spanda
```

spanda is an esm package for modern browsers.

## usage

```js
import { createSpanda } from 'spanda'

const sound = createSpanda({ profile: 'tactile' })

button.addEventListener('click', () => {
  sound.play('confirm')
})
```

create one instance for your app. the audio context, compressor, reverb and shared buffers are created lazily on the first `play()` or `resume()` call.

## cues

```js
sound.play('tap')
sound.play('type')
sound.play('toggleOn')
sound.play('toggleOff')
sound.play('notify')
sound.play('open')
sound.play('close')
sound.play('send')
sound.play('confirm')
sound.play('error')
sound.play('complete')
```

`type` is intentionally quiet enough for repeated progress feedback. `confirm` closes a routine task. `complete` is a longer composed cue for finishing an entire flow, voiced to match each profile.

## profiles

- `tactile` — balanced, compact and physical
- `crisp` — bright, precise and phone-speaker friendly
- `lush` — soft, rounded and more spacious

change the profile without rebuilding the audio graph:

```js
sound.setProfile('crisp')
```

override the profile for one cue without changing the instance default:

```js
sound.play('tap', { profile: 'crisp' })
sound.play('complete', { profile: 'lush' })
```

## custom profiles

built-in profiles are frozen plain objects. copy one and change only what matters:

```js
import { createSpanda, profiles } from 'spanda'

const muted = {
  ...profiles.tactile,
  baseFrequency: 132,
  reverb: 0.08,
  volumeVariationPercent: 2,
}

const sound = createSpanda({ profile: muted })
```

copied profiles retain their completion voice through `completionStyle`. profiles created from scratch can set it to `tactile`, `crisp` or `lush`; the default is `tactile`.

## custom cues

A cue is also a plain object:

```js
sound.play({
  hits: [
    { pitch: 1, gain: 0.42, glide: 1.04 },
    { offset: 0.07, pitch: 1.5, gain: 0.3, glide: 1.02 },
  ],
  decay: 0.8,
  reverb: 0.35,
  transient: 0.3,
  sub: 0.12,
})
```

This is deliberately the whole extension model: profiles describe the voice, recipes describe the gesture.

## control

```js
sound.setVolume(0.7)       // clamped between 0 and 1
sound.setEnabled(false)    // suspends the owned context
sound.setEnabled(true)
await sound.resume()       // useful inside an explicit user gesture
await sound.destroy()      // closes the owned context
```

Importing spanda is safe during server rendering. If Web Audio is unavailable or a browser blocks playback, calls fail closed instead of interrupting the host application.

## audition

```sh
pnpm install
pnpm demo
```

Open `http://127.0.0.1:4174` to compare every cue and profile.

## development

```sh
pnpm test
pnpm run test:browser
pnpm run check
```

The test suite stays intentionally small: focused engine behavior plus one real-browser pass through the compiled package.
