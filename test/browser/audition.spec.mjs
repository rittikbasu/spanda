import { expect, test } from '@playwright/test'

const expectedCues = [
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
]

test('auditions every cue through the compiled browser package', async ({ page }) => {
  const errors = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.addInitScript(() => {
    window.__audioCounts = { contexts: 0, sources: 0 }
    const NativeAudioContext = window.AudioContext
    window.AudioContext = class extends NativeAudioContext {
      constructor(...args) {
        super(...args)
        window.__audioCounts.contexts += 1
      }
    }

    for (const prototype of [OscillatorNode.prototype, AudioBufferSourceNode.prototype]) {
      const nativeStart = prototype.start
      prototype.start = function (...args) {
        window.__audioCounts.sources += 1
        return nativeStart.apply(this, args)
      }
    }
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'spanda' })).toBeVisible()
  await expect(page.locator('[data-cue]')).toHaveCount(expectedCues.length)
  expect(await page.evaluate(() => window.spanda.volume)).toBe(1)
  expect(await page.evaluate(() => window.__audioCounts.contexts)).toBe(0)

  const sourceCount = () => page.evaluate(() => window.__audioCounts.sources)
  const playAndMeasure = async (cue) => {
    const before = await sourceCount()
    await page.locator(`[data-cue="${cue}"]`).click()
    await expect.poll(sourceCount).toBeGreaterThan(before)
    return (await sourceCount()) - before
  }

  const crispProfile = page.locator('[data-profile="crisp"]')
  await crispProfile.focus()
  await page.keyboard.press('Enter')
  await expect(crispProfile).toBeFocused()
  expect(await playAndMeasure('type')).toBe(5)
  expect(await playAndMeasure('confirm')).toBe(10)
  expect(await playAndMeasure('complete')).toBe(8)

  await page.locator('[data-profile="tactile"]').click()
  expect(await playAndMeasure('type')).toBe(4)

  await page.locator('[data-profile="lush"]').click()
  expect(await playAndMeasure('type')).toBe(3)

  const beforeOverride = await sourceCount()
  await page.evaluate(() => window.spanda.play('type', { profile: 'crisp' }))
  await expect.poll(sourceCount).toBeGreaterThan(beforeOverride)
  expect((await sourceCount()) - beforeOverride).toBe(5)
  expect(await page.evaluate(() => window.spanda.profile.baseFrequency)).toBe(104)

  for (const cue of expectedCues.filter((name) => !['type', 'confirm', 'complete'].includes(name))) {
    await playAndMeasure(cue)
  }

  expect(await page.evaluate(() => window.__audioCounts.contexts)).toBe(1)
  expect(errors).toEqual([])
})
