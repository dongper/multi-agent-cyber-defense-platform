import { describe, expect, it } from 'vitest'
import ar from '../../packages/client/src/i18n/locales/ar'
import de from '../../packages/client/src/i18n/locales/de'
import en from '../../packages/client/src/i18n/locales/en'
import es from '../../packages/client/src/i18n/locales/es'
import fr from '../../packages/client/src/i18n/locales/fr'
import ja from '../../packages/client/src/i18n/locales/ja'
import ko from '../../packages/client/src/i18n/locales/ko'
import pt from '../../packages/client/src/i18n/locales/pt'
import ru from '../../packages/client/src/i18n/locales/ru'
import zhTW from '../../packages/client/src/i18n/locales/zh-TW'
import zh from '../../packages/client/src/i18n/locales/zh'

const locales = { ar, de, en, es, fr, ja, ko, pt, ru, 'zh-TW': zhTW, zh }

function leafPaths(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix]
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, child]) => leafPaths(child, prefix ? `${prefix}.${key}` : key))
    .sort()
}

describe('cyber defense locale coverage', () => {
  it('exposes the navigation label and every workspace key in all locales', () => {
    const expected = leafPaths(en.cyberDefense)
    for (const [name, messages] of Object.entries(locales)) {
      expect(messages.sidebar.cyberDefense, `${name} sidebar label`).toEqual(expect.any(String))
      expect(leafPaths(messages.cyberDefense), `${name} workspace keys`).toEqual(expected)
    }
  })
})
