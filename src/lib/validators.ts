export interface ValidationResult {
  valid: boolean
  errors: Record<string, string>
}

export function validateLoginForm(email: string, password: string): ValidationResult {
  const errors: Record<string, string> = {}

  if (!email.trim()) {
    errors.email = 'Email is required'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Invalid email format'
  }

  if (!password) {
    errors.password = 'Password is required'
  }

  return { valid: Object.keys(errors).length === 0, errors }
}

export function validateRegisterForm(
  name: string,
  email: string,
  password: string,
  confirmPassword: string
): ValidationResult {
  const errors: Record<string, string> = {}

  if (!name.trim()) {
    errors.name = 'Name is required'
  }

  if (!email.trim()) {
    errors.email = 'Email is required'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Invalid email format'
  }

  if (!password) {
    errors.password = 'Password is required'
  } else if (password.length < 8) {
    errors.password = 'Password must be at least 8 characters'
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Please confirm your password'
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match'
  }

  return { valid: Object.keys(errors).length === 0, errors }
}

export function validateForgotPasswordForm(email: string): ValidationResult {
  const errors: Record<string, string> = {}

  if (!email.trim()) {
    errors.email = 'Email is required'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Invalid email format'
  }

  return { valid: Object.keys(errors).length === 0, errors }
}
