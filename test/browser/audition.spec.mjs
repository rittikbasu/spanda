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

const responsiveWidths = [320, 390, 737, 738, 999, 1000, 1440]

async function readResponsiveGeometry(page) {
  return page.evaluate(() => {
    const identity = document.querySelector('.identity')
    const wordmark = identity.querySelector('h1')
    const tagline = identity.querySelector('.identity__copy')
    const pRange = document.createRange()
    const taglineRange = document.createRange()

    pRange.setStart(wordmark.firstChild, 1)
    pRange.setEnd(wordmark.firstChild, 2)
    taglineRange.selectNodeContents(tagline)

    const baselineFor = (element) => {
      const marker = document.createElement('span')
      marker.style.cssText = 'display:inline-block;width:0;height:0;padding:0;margin:0'
      element.append(marker)
      const baseline = marker.getBoundingClientRect().top
      marker.remove()
      return baseline
    }

    const wordmarkStyle = getComputedStyle(wordmark)
    const context = document.createElement('canvas').getContext('2d')
    context.font = [
      wordmarkStyle.fontStyle,
      wordmarkStyle.fontVariant,
      wordmarkStyle.fontWeight,
      wordmarkStyle.fontSize,
      wordmarkStyle.fontFamily,
    ].join(' ')

    return {
      baselineDelta: baselineFor(tagline)
        - baselineFor(wordmark)
        - context.measureText('p').actualBoundingBoxDescent,
      clearance: taglineRange.getBoundingClientRect().left - pRange.getBoundingClientRect().right,
      documentWidth: document.documentElement.scrollWidth,
      listenSize: getComputedStyle(document.querySelector('.section-head h2')).fontSize,
      readySize: getComputedStyle(document.querySelector('.readout__cue')).fontSize,
      singleLine: tagline.getBoundingClientRect().height
        <= Number.parseFloat(getComputedStyle(tagline).lineHeight) + 0.2,
    }
  })
}

test('preserves the responsive identity geometry', async ({ page }) => {
  await page.goto('/')

  for (const width of responsiveWidths) {
    await page.setViewportSize({ width, height: 900 })
    await page.evaluate(async () => {
      await document.fonts.ready
      await new Promise(requestAnimationFrame)
    })

    const geometry = await readResponsiveGeometry(page)
    const tucked = width <= 737 || width >= 1000

    expect(geometry.documentWidth).toBe(width)
    expect(geometry.listenSize).toBe(geometry.readySize)

    if (tucked) {
      expect(geometry.singleLine).toBe(true)
      expect(geometry.clearance).toBeCloseTo(-1, 1)
      expect(geometry.baselineDelta).toBeCloseTo(0, 1)
    } else {
      expect(geometry.clearance).toBeLessThan(-10)
      expect(geometry.baselineDelta).toBeGreaterThan(10)
    }
  }
})

test('restores focus and announces the clipboard fallback', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () => Promise.reject(new Error('clipboard unavailable')),
      },
    })
  })
  await page.goto('/')

  const copyButton = page.locator('#copy-install')
  await copyButton.focus()
  await page.keyboard.press('Enter')

  await expect(copyButton).toBeFocused()
  await expect(page.locator('#copy-announcement')).toHaveText('install command copied')
})

test('returns touch cues to neutral styling after playback', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  const page = await context.newPage()

  try {
    await page.goto('/')
    const cue = page.locator('[data-cue="confirm"]')
    const readStyle = () => cue.evaluate((element) => ({
      background: getComputedStyle(element).backgroundColor,
      nameTransform: getComputedStyle(element.querySelector('.cue__name')).transform,
    }))
    const neutralStyle = await readStyle()

    await cue.tap()
    await expect(cue).toHaveClass(/is-playing/)
    await expect(cue).not.toHaveClass(/is-playing/, { timeout: 1000 })
    await page.waitForTimeout(250)

    expect(await readStyle()).toEqual(neutralStyle)
  } finally {
    await context.close()
  }
})

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

  await expect(page.locator('.identity > .install')).toHaveCount(1)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('.audition > .install')).toHaveCount(1)
  expect(await page.evaluate(() => {
    const cues = document.querySelector('#cues')
    const install = document.querySelector('.install')
    return Boolean(cues.compareDocumentPosition(install) & Node.DOCUMENT_POSITION_FOLLOWING)
  })).toBe(true)
  await page.setViewportSize({ width: 1280, height: 720 })
  await expect(page.locator('.identity > .install')).toHaveCount(1)

  const sourceCount = () => page.evaluate(() => window.__audioCounts.sources)
  const measureSources = async (action) => {
    const before = await sourceCount()
    await action()
    await expect.poll(sourceCount).toBeGreaterThan(before)
    return (await sourceCount()) - before
  }
  const playAndMeasure = (cue) => measureSources(
    () => page.locator(`[data-cue="${cue}"]`).click(),
  )

  await measureSources(() => page.locator('#copy-install').click())
  await expect(page.locator('#copy-state')).toHaveText('copied')

  const crispProfile = page.locator('[data-profile="crisp"]')
  await measureSources(async () => {
    await crispProfile.focus()
    await page.keyboard.press('Enter')
  })
  await expect(crispProfile).toBeFocused()
  expect(await playAndMeasure('type')).toBe(5)
  const confirmCue = page.locator('[data-cue="confirm"]')
  expect(await playAndMeasure('confirm')).toBe(10)
  await expect(confirmCue).toHaveClass(/is-playing/)
  await expect(confirmCue).not.toHaveClass(/is-playing/, { timeout: 1000 })
  await expect(page.locator('.cue.is-last')).toHaveCount(0)
  expect(await playAndMeasure('complete')).toBe(8)

  await page.locator('[data-profile="tactile"]').click()
  expect(await playAndMeasure('type')).toBe(4)

  await page.locator('[data-profile="lush"]').click()
  expect(await playAndMeasure('type')).toBe(3)

  expect(await measureSources(
    () => page.evaluate(() => window.spanda.play('type', { profile: 'crisp' })),
  )).toBe(5)
  expect(await page.evaluate(() => window.spanda.profile.baseFrequency)).toBe(104)

  for (const cue of expectedCues.filter((name) => !['type', 'confirm', 'complete'].includes(name))) {
    await playAndMeasure(cue)
  }

  expect(await page.evaluate(() => window.__audioCounts.contexts)).toBe(1)
  expect(errors).toEqual([])
})
