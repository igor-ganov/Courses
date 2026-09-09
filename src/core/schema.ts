/**
 * СХЕМА — проверка содержания курса.
 *
 * Курс здесь пишется данными, а не кодом, и это работает ровно до тех пор, пока
 * ошибка автора остаётся видимой. Поэтому у проверки два свойства, ради которых
 * она вообще написана вручную, а не взята готовой библиотекой:
 *
 *   — адрес. Каждая беда приходит с путём `modules[1].topics[0].title`, потому
 *     что автор правит файл, а не отладчик.
 *   — полнота. Возвращаются все ошибки разом: править содержание по одной
 *     ошибке за проход — это десяток проходов сборки на одну лекцию.
 *
 * Ноль зависимостей: платформа офлайн-первая, и всё, что попадает в поставку,
 * должно быть либо нужным, либо своим. Здесь около двух сотен строк — дешевле,
 * чем тянуть валидатор с его собственной вселенной типов.
 */

export interface Issue {
  /** Адрес места в данных: `modules[1].title`. Пустой — сам корень. */
  readonly path: string;
  readonly message: string;
}

export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly issues: readonly Issue[] };

export interface Schema<T> {
  check(value: unknown, path?: string): Result<T>;
  /** Условие, которого не выразить типом: «конец после начала», «сумма равна ста». */
  where(predicate: (value: T) => boolean, message: string): Schema<T>;
}

/** Тип, который описывает схема: `Infer<typeof course>`. */
export type Infer<S> = S extends Schema<infer T> ? T : never;

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (path: string, message: string): Result<never> => ({
  ok: false,
  issues: [{ path, message }],
});

/* Имя пришедшего — для сообщений. «пришло ничего» читается лучше, чем
   «пришло undefined»: автор пишет текст, а не код. */
function whatCame(value: unknown): string {
  if (value === undefined) return 'ничего';
  if (value === null) return 'пусто';
  if (Array.isArray(value)) return 'список';
  if (typeof value === 'number') return Number.isNaN(value) ? 'не-число' : 'число';
  if (typeof value === 'string') return 'строка';
  if (typeof value === 'boolean') return 'да/нет';
  if (typeof value === 'object') return 'запись';
  return typeof value;
}

/* Общая часть всех схем: сама проверка приходит функцией, `where` навешивается
   поверх и работает только на уже разобранном значении. */
function schema<T>(check: (value: unknown, path: string) => Result<T>): Schema<T> {
  return {
    check: (value, path = '') => check(value, path),
    where(predicate, message) {
      return schema<T>((value, path) => {
        const r = check(value, path);
        if (!r.ok) return r;
        return predicate(r.value) ? r : fail(path, message);
      });
    },
  };
}

export interface TextOptions {
  /** Пустая строка обычно означает недописанный текст, поэтому по умолчанию запрещена. */
  readonly allowEmpty?: boolean;
  readonly min?: number;
  readonly max?: number;
}

export function text(options: TextOptions = {}): Schema<string> {
  return schema((value, path) => {
    if (typeof value !== 'string') return fail(path, `ожидалась строка, пришло ${whatCame(value)}`);
    if (!options.allowEmpty && value.trim() === '') return fail(path, 'строка пустая');
    if (options.min !== undefined && value.length < options.min) {
      return fail(path, `строка короче ${options.min} знаков`);
    }
    if (options.max !== undefined && value.length > options.max) {
      return fail(path, `строка длиннее ${options.max} знаков`);
    }
    return ok(value);
  });
}

export interface NumberOptions {
  readonly min?: number;
  readonly max?: number;
  readonly integer?: boolean;
}

export function number(options: NumberOptions = {}): Schema<number> {
  return schema((value, path) => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return fail(path, `ожидалось число, пришло ${whatCame(value)}`);
    }
    if (options.integer && !Number.isInteger(value)) return fail(path, 'ожидалось целое число');
    if (options.min !== undefined && value < options.min) return fail(path, `меньше ${options.min}`);
    if (options.max !== undefined && value > options.max) return fail(path, `больше ${options.max}`);
    return ok(value);
  });
}

export function flag(): Schema<boolean> {
  return schema((value, path) =>
    typeof value === 'boolean' ? ok(value) : fail(path, `ожидалось да/нет, пришло ${whatCame(value)}`),
  );
}

export function literal<const T extends string | number | boolean>(expected: T): Schema<T> {
  return schema((value, path) =>
    value === expected ? ok(expected) : fail(path, `ожидалось ${JSON.stringify(expected)}`),
  );
}

export function oneOf<const T extends readonly (string | number)[]>(allowed: T): Schema<T[number]> {
  return schema((value, path) =>
    allowed.includes(value as T[number])
      ? ok(value as T[number])
      : fail(path, `ожидалось одно из ${allowed.join(', ')}; пришло ${JSON.stringify(value)}`),
  );
}

export interface ListOptions {
  readonly min?: number;
  readonly max?: number;
}

export function list<T>(item: Schema<T>, options: ListOptions = {}): Schema<T[]> {
  return schema((value, path) => {
    if (!Array.isArray(value)) return fail(path, `ожидался список, пришло ${whatCame(value)}`);
    if (options.min !== undefined && value.length < options.min) {
      return fail(path, `нужно хотя бы ${options.min} шт., пришло ${value.length}`);
    }
    if (options.max !== undefined && value.length > options.max) {
      return fail(path, `не больше ${options.max} шт., пришло ${value.length}`);
    }
    const issues: Issue[] = [];
    const out: T[] = [];
    value.forEach((element, i) => {
      const r = item.check(element, `${path}[${i}]`);
      if (r.ok) out.push(r.value);
      else issues.push(...r.issues);
    });
    return issues.length ? { ok: false, issues } : ok(out);
  });
}

/** Поле, которое можно не писать. Написанное — проверяется как обычно. */
const OPTIONAL = Symbol('optional');
type Optional<T> = Schema<T | undefined> & { readonly [OPTIONAL]: true };

export function optional<T>(inner: Schema<T>): Optional<T> {
  const s = schema<T | undefined>((value, path) =>
    value === undefined ? ok(undefined) : inner.check(value, path),
  );
  return Object.assign(s, { [OPTIONAL]: true } as const);
}

type Fields = Record<string, Schema<unknown>>;

/* Необязательные поля должны попасть в тип с «?», иначе `exactOptionalPropertyTypes`
   заставит автора писать `year: undefined` руками. И именно с «?», а не с
   «| undefined»: разобранная запись не хранит пустых полей — их выбрасывает
   `record`, — поэтому и в типе их быть не должно. */
type FieldsOf<F extends Fields> = {
  [K in keyof F as F[K] extends { readonly [OPTIONAL]: true } ? never : K]: Infer<F[K]>;
} & {
  [K in keyof F as F[K] extends { readonly [OPTIONAL]: true } ? K : never]?: Exclude<
    Infer<F[K]>,
    undefined
  >;
};

type Expand<T> = { [K in keyof T]: T[K] } & {};

export function record<F extends Fields>(fields: F): Schema<Expand<FieldsOf<F>>> {
  return schema((value, path) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return fail(path, `ожидалась запись, пришло ${whatCame(value)}`);
    }
    const source = value as Record<string, unknown>;
    const issues: Issue[] = [];
    const out: Record<string, unknown> = {};

    for (const [key, field] of Object.entries(fields)) {
      const at = path ? `${path}.${key}` : key;
      const r = field.check(source[key], at);
      if (!r.ok) issues.push(...r.issues);
      else if (r.value !== undefined) out[key] = r.value;
    }

    /* Лишнее поле — почти всегда опечатка в имени: `yaer` вместо `year`.
       Промолчать здесь значит потерять данные молча. */
    for (const key of Object.keys(source)) {
      if (!(key in fields)) issues.push({ path, message: `неизвестное поле "${key}"` });
    }

    return issues.length ? { ok: false, issues } : ok(out as Expand<FieldsOf<F>>);
  });
}

/**
 * Размеченный союз: поле-метка выбирает ветвь. Именно так устроены блоки лекции,
 * и именно поэтому ошибка обязана приходить из выбранной ветви — иначе автор
 * получает свалку жалоб от всех вариантов сразу и не понимает, какой он писал.
 */
export function variant<M extends string, B extends Record<string, Schema<unknown>>>(
  marker: M,
  branches: B,
): Schema<Infer<B[keyof B]>> {
  return schema((value, path) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return fail(path, `ожидалась запись, пришло ${whatCame(value)}`);
    }
    const tag = (value as Record<string, unknown>)[marker];
    const at = path ? `${path}.${marker}` : marker;
    if (typeof tag !== 'string') return fail(at, `ожидалась строка, пришло ${whatCame(tag)}`);
    const branch = branches[tag];
    if (!branch) {
      return fail(at, `неизвестный вид ${JSON.stringify(tag)}; известны ${Object.keys(branches).join(', ')}`);
    }
    return branch.check(value, path) as Result<Infer<B[keyof B]>>;
  });
}

/** Отложенная ссылка: без неё блок не может содержать блоки. */
export function lazy<T>(build: () => Schema<T>): Schema<T> {
  let built: Schema<T> | undefined;
  return schema((value, path) => (built ??= build()).check(value, path));
}

export class SchemaError extends Error {
  constructor(readonly issues: readonly Issue[]) {
    super(issues.map((i) => `${i.path || '<корень>'}: ${i.message}`).join('\n'));
    this.name = 'SchemaError';
  }
}

/** Разбор для сборки: либо значение, либо падение со всем списком бед разом. */
export function parse<T>(s: Schema<T>, value: unknown, path = ''): T {
  const r = s.check(value, path);
  if (!r.ok) throw new SchemaError(r.issues);
  return r.value;
}
