/**
 * A tiny, dependency-free schema library.
 *
 * Content on this platform is data: lectures are trees of blocks whose props are
 * authored by hand. The registry validates every block against the schema its
 * definition ships with, so a typo in a course file surfaces as a precise
 * `path -> message` issue instead of a blank screen. Keeping the validator in
 * the repo (rather than pulling a runtime dependency) keeps the offline bundle
 * small and makes the authoring contract explicit and testable.
 */

export interface ValidationIssue {
  /** Dotted path to the offending value, e.g. `steps[2].label`. */
  path: string;
  message: string;
  code: 'type' | 'range' | 'pattern' | 'missing' | 'unknown_key' | 'custom' | 'union';
}

export type Result<T> = { ok: true; value: T } | { ok: false; errors: ValidationIssue[] };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = (errors: ValidationIssue[]): Result<never> => ({ ok: false, errors });

const issue = (
  path: string,
  message: string,
  code: ValidationIssue['code'] = 'type',
): ValidationIssue => ({ path, message, code });

/** Prefix child issues with the parent path segment. */
const nest = (base: string, issues: ValidationIssue[]): ValidationIssue[] =>
  issues.map((i) => ({
    ...i,
    path: i.path.startsWith('[') ? `${base}${i.path}` : base ? (i.path ? `${base}.${i.path}` : base) : i.path,
  }));

export interface Schema<T> {
  readonly kind: string;
  /** Validate an unknown value, returning either the typed value or issues. */
  parse(value: unknown, path?: string): Result<T>;
  /** Short type description, used by authoring/debug tooling. */
  describe(): string;
  /** Marker for optional object members; never set on the value itself. */
  readonly __optional?: boolean;
  readonly __default?: () => T;
}

export type Infer<S> = S extends Schema<infer T> ? T : never;

/**
 * A schema marked as an optional object member: absent input stays absent, so
 * the key is optional in the inferred type too.
 */
export interface OptionalSchema<T> extends Schema<T> {
  readonly __optional: true;
  readonly __hasDefault?: false;
}

/**
 * A schema with a default: the key may be omitted by the author, but the parsed
 * value always has it. That asymmetry between input and output is exactly what
 * lets a widget read `props.title` without a null check.
 */
export interface DefaultedSchema<T> extends Schema<T> {
  readonly __optional: true;
  readonly __hasDefault: true;
}

type ObjectShape = Record<string, Schema<unknown>>;

/** Optional in the *output*: declared optional and carrying no default. */
type OptionalKeys<S extends ObjectShape> = {
  [K in keyof S]: S[K] extends { __hasDefault: true }
    ? never
    : S[K] extends { __optional: true }
      ? K
      : never;
}[keyof S];

type RequiredKeys<S extends ObjectShape> = Exclude<keyof S, OptionalKeys<S>>;

export type InferObject<S extends ObjectShape> = {
  [K in RequiredKeys<S>]: Infer<S[K]>;
} & {
  [K in OptionalKeys<S>]?: Infer<S[K]>;
};

const define = <T>(kind: string, describe: string, parse: Schema<T>['parse']): Schema<T> => ({
  kind,
  parse,
  describe: () => describe,
});

export interface StringOptions {
  min?: number;
  max?: number;
  pattern?: RegExp;
}

const string = (opts: StringOptions = {}): Schema<string> =>
  define('string', 'string', (value, path = '') => {
    if (typeof value !== 'string') return err([issue(path, `expected string, got ${typeName(value)}`)]);
    const issues: ValidationIssue[] = [];
    if (opts.min !== undefined && value.length < opts.min)
      issues.push(issue(path, `expected at least ${opts.min} characters`, 'range'));
    if (opts.max !== undefined && value.length > opts.max)
      issues.push(issue(path, `expected at most ${opts.max} characters`, 'range'));
    if (opts.pattern && !opts.pattern.test(value))
      issues.push(issue(path, `does not match ${String(opts.pattern)}`, 'pattern'));
    return issues.length ? err(issues) : ok(value);
  });

export interface NumberOptions {
  min?: number;
  max?: number;
  int?: boolean;
}

const number = (opts: NumberOptions = {}): Schema<number> =>
  define('number', 'number', (value, path = '') => {
    if (typeof value !== 'number' || Number.isNaN(value))
      return err([issue(path, `expected number, got ${typeName(value)}`)]);
    const issues: ValidationIssue[] = [];
    if (opts.int && !Number.isInteger(value)) issues.push(issue(path, 'expected an integer', 'range'));
    if (opts.min !== undefined && value < opts.min)
      issues.push(issue(path, `expected >= ${opts.min}`, 'range'));
    if (opts.max !== undefined && value > opts.max)
      issues.push(issue(path, `expected <= ${opts.max}`, 'range'));
    return issues.length ? err(issues) : ok(value);
  });

const boolean = (): Schema<boolean> =>
  define('boolean', 'boolean', (value, path = '') =>
    typeof value === 'boolean'
      ? ok(value)
      : err([issue(path, `expected boolean, got ${typeName(value)}`)]),
  );

const literal = <const T extends string | number | boolean>(expected: T): Schema<T> =>
  define('literal', JSON.stringify(expected), (value, path = '') =>
    value === expected ? ok(expected) : err([issue(path, `expected ${JSON.stringify(expected)}`)]),
  );

const enumOf = <const T extends readonly (string | number)[]>(values: T): Schema<T[number]> =>
  define('enum', values.join(' | '), (value, path = '') =>
    values.includes(value as T[number])
      ? ok(value as T[number])
      : err([issue(path, `expected one of ${values.join(', ')}`)]),
  );

const array = <T>(inner: Schema<T>, opts: { min?: number; max?: number } = {}): Schema<T[]> =>
  define('array', `${inner.describe()}[]`, (value, path = '') => {
    if (!Array.isArray(value)) return err([issue(path, `expected array, got ${typeName(value)}`)]);
    const issues: ValidationIssue[] = [];
    if (opts.min !== undefined && value.length < opts.min)
      issues.push(issue(path, `expected at least ${opts.min} items`, 'range'));
    if (opts.max !== undefined && value.length > opts.max)
      issues.push(issue(path, `expected at most ${opts.max} items`, 'range'));
    const out: T[] = [];
    value.forEach((item, index) => {
      const res = inner.parse(item, '');
      if (res.ok) out.push(res.value);
      else issues.push(...nest(`${path}[${index}]`, res.errors));
    });
    return issues.length ? err(issues) : ok(out);
  });

const record = <T>(inner: Schema<T>): Schema<Record<string, T>> =>
  define('record', `Record<string, ${inner.describe()}>`, (value, path = '') => {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      return err([issue(path, `expected object, got ${typeName(value)}`)]);
    const issues: ValidationIssue[] = [];
    const out: Record<string, T> = {};
    for (const [key, item] of Object.entries(value)) {
      const res = inner.parse(item, '');
      if (res.ok) out[key] = res.value;
      else issues.push(...nest(path ? `${path}.${key}` : key, res.errors));
    }
    return issues.length ? err(issues) : ok(out);
  });

const object = <S extends ObjectShape>(shape: S): Schema<InferObject<S>> =>
  define('object', `{ ${Object.keys(shape).join(', ')} }`, (value, path = '') => {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      return err([issue(path, `expected object, got ${typeName(value)}`)]);
    const source = value as Record<string, unknown>;
    const issues: ValidationIssue[] = [];
    const out: Record<string, unknown> = {};

    for (const [key, schema] of Object.entries(shape)) {
      const childPath = path ? `${path}.${key}` : key;
      const present = Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined;
      if (!present) {
        if (schema.__default) out[key] = schema.__default();
        else if (!schema.__optional) issues.push(issue(childPath, `missing required key "${key}"`, 'missing'));
        continue;
      }
      const res = schema.parse(source[key], '');
      if (res.ok) out[key] = res.value;
      else issues.push(...nest(childPath, res.errors));
    }

    for (const key of Object.keys(source)) {
      if (!(key in shape))
        issues.push(
          issue(path ? `${path}.${key}` : key, `unknown key "${key}"`, 'unknown_key'),
        );
    }

    return issues.length ? err(issues) : ok(out as InferObject<S>);
  });

const optional = <T>(inner: Schema<T>): OptionalSchema<T> => ({
  ...inner,
  __optional: true,
  parse: (value, path = '') => (value === undefined ? ok(undefined as T) : inner.parse(value, path)),
  describe: () => `${inner.describe()}?`,
});

const withDefault = <T>(inner: Schema<T>, fallback: T | (() => T)): DefaultedSchema<T> => ({
  ...inner,
  __optional: true,
  __hasDefault: true,
  __default: () => (typeof fallback === 'function' ? (fallback as () => T)() : fallback),
  parse: (value, path = '') =>
    value === undefined
      ? ok(typeof fallback === 'function' ? (fallback as () => T)() : fallback)
      : inner.parse(value, path),
  describe: () => `${inner.describe()} = ${JSON.stringify(fallback)}`,
});

const union = <T extends readonly Schema<unknown>[]>(
  branches: T,
): Schema<Infer<T[number]>> =>
  define('union', branches.map((b) => b.describe()).join(' | '), (value, path = '') => {
    for (const branch of branches) {
      const res = branch.parse(value, path);
      if (res.ok) return res as Result<Infer<T[number]>>;
    }
    return err([
      issue(path, `no union branch matched (${branches.map((b) => b.describe()).join(' | ')})`, 'union'),
    ]);
  });

const refine = <T>(inner: Schema<T>, check: (value: T) => string | null): Schema<T> =>
  define(`${inner.kind}:refined`, inner.describe(), (value, path = '') => {
    const res = inner.parse(value, path);
    if (!res.ok) return res;
    const message = check(res.value);
    return message === null ? res : err([issue(path, message, 'custom')]);
  });

const lazy = <T>(factory: () => Schema<T>): Schema<T> => {
  let cached: Schema<T> | null = null;
  const resolve = () => (cached ??= factory());
  return define('lazy', 'lazy', (value, path = '') => resolve().parse(value, path));
};

/** Accepts anything; used by blocks that keep an opaque payload. */
const unknown = (): Schema<unknown> => define('unknown', 'unknown', (value) => ok(value));

function typeName(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number' && Number.isNaN(value)) return 'NaN';
  return typeof value;
}

export const s = {
  string,
  number,
  boolean,
  literal,
  enum: enumOf,
  array,
  record,
  object,
  optional,
  withDefault,
  union,
  refine,
  lazy,
  unknown,
};

/** Render issues as a multi-line, human-readable report. */
export function formatIssues(issues: ValidationIssue[]): string {
  return issues.map((i) => `  • ${i.path || '<root>'}: ${i.message}`).join('\n');
}
