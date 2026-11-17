'use strict';

// Small validators. Each returns a cleaned value, or records a problem in `errors`.
class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

class Problems {
  constructor() { this.fields = {}; }
  add(field, message) { if (!this.fields[field]) this.fields[field] = message; }
  get any() { return Object.keys(this.fields).length > 0; }
  throwIfAny() {
    if (this.any) throw new ApiError(400, 'invalid_input', 'Please check the highlighted fields.', this.fields);
  }
}

function str(problems, body, field, { min = 0, max = 200, required = false, label } = {}) {
  const name = label || field;
  let v = body[field];
  if (v === undefined || v === null) v = '';
  if (typeof v !== 'string') { problems.add(field, `${name} must be text.`); return ''; }
  v = v.trim();
  if (v.length === 0 && required) { problems.add(field, `${name} is required.`); return ''; }
  if (v.length > 0 && v.length < min) { problems.add(field, `${name} must be at least ${min} characters.`); }
  if (v.length > max) { problems.add(field, `${name} must be ${max} characters or fewer.`); }
  return v;
}

function oneOf(problems, body, field, allowed, { required = false, label } = {}) {
  const name = label || field;
  const v = body[field];
  if ((v === undefined || v === null || v === '') && !required) return null;
  if (!allowed.includes(v)) { problems.add(field, `${name} is not a valid choice.`); return null; }
  return v;
}

function num(problems, body, field, { min = -Infinity, max = Infinity, integer = false, required = false, label } = {}) {
  const name = label || field;
  const v = body[field];
  if ((v === undefined || v === null || v === '') && !required) return null;
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) { problems.add(field, `${name} must be a number.`); return null; }
  if (integer && !Number.isInteger(n)) { problems.add(field, `${name} must be a whole number.`); return null; }
  if (n < min || n > max) { problems.add(field, `${name} must be between ${min} and ${max}.`); return null; }
  return n;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function email(problems, body, field, { required = true } = {}) {
  const v = str(problems, body, field, { max: 120, required, label: 'Email' }).toLowerCase();
  if (v && !EMAIL.test(v)) problems.add(field, 'Email looks incorrect.');
  return v;
}

function phone(problems, body, field, { required = true } = {}) {
  const v = str(problems, body, field, { max: 20, required, label: 'Phone' });
  if (v && !/^\+?[0-9 ()-]{6,20}$/.test(v)) problems.add(field, 'Phone number looks incorrect.');
  return v;
}

function isDateString(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}

module.exports = { ApiError, Problems, str, oneOf, num, email, phone, isDateString };
