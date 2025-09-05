import { ErrorSeverity, ErrorCategory } from '@/constants';

export class BaseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly severity: ErrorSeverity = ErrorSeverity.ERROR,
    public readonly category: ErrorCategory = ErrorCategory.SYSTEM,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends BaseError {
  constructor(code: string, message: string) {
    super(message, code, ErrorSeverity.LOW, ErrorCategory.VALIDATION);
  }
}

export class SecurityError extends BaseError {
  constructor(code: string, message: string) {
    super(message, code, ErrorSeverity.HIGH, ErrorCategory.SECURITY);
  }
}

export class SessionImportError extends ValidationError {
  constructor(message: string) {
    super('ERR_SESSION_IMPORT', message);
  }
}
