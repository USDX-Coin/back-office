import { describe, test, expect } from 'vitest'
import { validateLoginForm, validateRegisterForm, validateForgotPasswordForm } from '@/lib/validators'

describe('validateLoginForm', () => {
  describe('positive', () => {
    test('should pass with valid email and password', () => {
      const result = validateLoginForm('admin@usdx.com', 'password123')
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual({})
    })
  })

  describe('negative', () => {
    test('should fail with empty email', () => {
      const result = validateLoginForm('', 'password123')
      expect(result.valid).toBe(false)
      expect(result.errors.email).toBe('Email is required')
    })

    test('should fail with invalid email format', () => {
      const result = validateLoginForm('not-an-email', 'password123')
      expect(result.valid).toBe(false)
      expect(result.errors.email).toBe('Invalid email format')
    })

    test('should fail with empty password', () => {
      const result = validateLoginForm('admin@usdx.com', '')
      expect(result.valid).toBe(false)
      expect(result.errors.password).toBe('Password is required')
    })

    test('should fail with both empty', () => {
      const result = validateLoginForm('', '')
      expect(result.valid).toBe(false)
      expect(Object.keys(result.errors)).toHaveLength(2)
    })
  })

  describe('edge cases', () => {
    test('should fail with whitespace-only email', () => {
      const result = validateLoginForm('   ', 'password123')
      expect(result.valid).toBe(false)
      expect(result.errors.email).toBe('Email is required')
    })
  })
})

describe('validateRegisterForm', () => {
  describe('positive', () => {
    test('should pass with all valid fields', () => {
      const result = validateRegisterForm('John Doe', 'john@usdx.com', 'password123', 'password123')
      expect(result.valid).toBe(true)
    })
  })

  describe('negative', () => {
    test('should fail with empty name', () => {
      const result = validateRegisterForm('', 'john@usdx.com', 'password123', 'password123')
      expect(result.valid).toBe(false)
      expect(result.errors.name).toBe('Name is required')
    })

    test('should fail with short password', () => {
      const result = validateRegisterForm('John', 'john@usdx.com', 'short', 'short')
      expect(result.valid).toBe(false)
      expect(result.errors.password).toBe('Password must be at least 8 characters')
    })

    test('should fail with mismatched passwords', () => {
      const result = validateRegisterForm('John', 'john@usdx.com', 'password123', 'different456')
      expect(result.valid).toBe(false)
      expect(result.errors.confirmPassword).toBe('Passwords do not match')
    })

    test('should fail with empty confirm password', () => {
      const result = validateRegisterForm('John', 'john@usdx.com', 'password123', '')
      expect(result.valid).toBe(false)
      expect(result.errors.confirmPassword).toBe('Please confirm your password')
    })
  })

  describe('edge cases', () => {
    test('should collect all errors at once', () => {
      const result = validateRegisterForm('', '', '', '')
      expect(result.valid).toBe(false)
      expect(Object.keys(result.errors).length).toBeGreaterThanOrEqual(3)
    })
  })
})

describe('validateForgotPasswordForm', () => {
  describe('positive', () => {
    test('should pass with valid email', () => {
      const result = validateForgotPasswordForm('admin@usdx.com')
      expect(result.valid).toBe(true)
    })
  })

  describe('negative', () => {
    test('should fail with empty email', () => {
      const result = validateForgotPasswordForm('')
      expect(result.valid).toBe(false)
      expect(result.errors.email).toBe('Email is required')
    })

    test('should fail with invalid email', () => {
      const result = validateForgotPasswordForm('invalid')
      expect(result.valid).toBe(false)
      expect(result.errors.email).toBe('Invalid email format')
    })
  })

  describe('edge cases', () => {
    test('should fail with whitespace-only email', () => {
      const result = validateForgotPasswordForm('   ')
      expect(result.valid).toBe(false)
    })
  })
})
