# spanda (स्पन्द)

procedural interface sounds for the web.

**~4.2 kB minified + gzipped · zero dependencies · zero audio files · typescript types included**

spanda synthesizes a small set of tactile ui sounds with the web audio api. there are no audio assets to preload. its plain api works with any framework.

the name comes from *spanda* (स्पन्द), sanskrit for pulse or vibration.

[listen to every cue and profile](https://rittikbasu.github.io/spanda/)

## install

```sh
npm install spanda
```

spanda ships as esm for modern browsers.

## quick start

```js
import { createSpanda } from 'spanda'

const sound = createSpanda()

button.addEventListener('click', () => {
  sound.play('confirm')
})
```

create one instance for your app. spanda creates its audio context and shared graph on the first `play()` or `resume()` call, not when the module is imported.

## cues

| cue | use |
| --- | --- |
| `tap` | buttons and lightweight interactions |
| `type` | quiet, repeatable progress feedback |
| `toggleOn`, `toggleOff` | binary state changes |
| `notify` | incoming updates |
| `open`, `close` | surfaces and navigation |
| `send` | outgoing actions |
| `confirm` | routine task completion |
| `error` | failed actions |
| `complete` | finishing an entire flow |

`complete` is a longer composed cue with different voicing for each profile.

## profiles

| profile | character |
| --- | --- |
| `tactile` | balanced, compact and physical |
| `crisp` | bright, precise and phone-speaker friendly |
| `lush` | soft, rounded and more spacious |

change the profile without rebuilding the audio graph:

```js
sound.setProfile('crisp')
```

override it for one cue without changing the instance default:

```js
sound.play('tap', { profile: 'crisp' })
sound.play('complete', { profile: 'lush' })
```

## custom profiles

built-in profiles are deeply frozen plain objects. copy one and change only what matters:

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

a profile copied from a built-in keeps its completion voice. profiles created from scratch can set `completionStyle` to `tactile`, `crisp` or `lush`; the default is `tactile`.

## custom cues

a cue is a plain object too:

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

profiles describe the voice. cue recipes describe the gesture. that is the whole extension model.

## control

```js
sound.setVolume(0.7)       // clamped between 0 and 1
sound.setEnabled(false)    // suspends the owned context
sound.setEnabled(true)
await sound.resume()       // useful inside an explicit user gesture
await sound.destroy()      // closes the owned context
```

## browser behavior

start playback from a user gesture such as a click so the browser can allow audio. importing spanda during server rendering is safe. if the web audio api is unavailable or playback is blocked, sound calls become no-ops instead of interrupting the app.

## development

```sh
pnpm install
pnpm demo
pnpm run check
```
