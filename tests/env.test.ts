import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { getTestSys, isRealSys, isDiskSys } from '../src/env.js'

describe('TEST_SYS environment', () => {
  let originalEnv: string | undefined

  beforeEach(() => {
    originalEnv = process.env.TEST_SYS
  })

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.TEST_SYS
    } else {
      process.env.TEST_SYS = originalEnv
    }
  })

  describe('getTestSys', () => {
    test('returns "fake" by default', () => {
      delete process.env.TEST_SYS
      expect(getTestSys()).toBe('fake')
    })

    test('returns "fake" when set', () => {
      process.env.TEST_SYS = 'fake'
      expect(getTestSys()).toBe('fake')
    })

    test('returns "real:mem" when set', () => {
      process.env.TEST_SYS = 'real:mem'
      expect(getTestSys()).toBe('real:mem')
    })

    test('returns "real:disk" when set', () => {
      process.env.TEST_SYS = 'real:disk'
      expect(getTestSys()).toBe('real:disk')
    })

    test('returns "fake" for invalid values with warning', () => {
      process.env.TEST_SYS = 'invalid'
      // Should warn and return fake
      expect(getTestSys()).toBe('fake')
    })
  })

  describe('isRealSys', () => {
    test('returns false for fake', () => {
      process.env.TEST_SYS = 'fake'
      expect(isRealSys()).toBe(false)
    })

    test('returns true for real:mem', () => {
      process.env.TEST_SYS = 'real:mem'
      expect(isRealSys()).toBe(true)
    })

    test('returns true for real:disk', () => {
      process.env.TEST_SYS = 'real:disk'
      expect(isRealSys()).toBe(true)
    })
  })

  describe('isDiskSys', () => {
    test('returns false for fake', () => {
      process.env.TEST_SYS = 'fake'
      expect(isDiskSys()).toBe(false)
    })

    test('returns false for real:mem', () => {
      process.env.TEST_SYS = 'real:mem'
      expect(isDiskSys()).toBe(false)
    })

    test('returns true for real:disk', () => {
      process.env.TEST_SYS = 'real:disk'
      expect(isDiskSys()).toBe(true)
    })
  })
})
