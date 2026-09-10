/**
 * YAML — подмножество, которого хватает манифесту, и ни строчкой больше.
 *
 * Разбор нужен затем, что читатель должен писать **настоящий** манифест, а
 * не заполнять поля в форме. Форма учит форме; манифест учит манифесту, и
 * ошибки в нём тоже настоящие: не то отступление, не тот вид значения,
 * опечатка в имени поля.
 *
 * Полный YAML сюда не нужен и вреден: якоря, многострочные скаляры, потоки
 * и семь способов написать «да» — это не то, чему учит курс, а разбирать их
 * значит завести в тетради второй язык. Поддержано ровно то, что бывает в
 * манифесте:
 *
 *   — вложенность отступами по два пробела;
 *   — `ключ: значение` и `ключ:` с вложенным блоком;
 *   — списки через `- `, в том числе список записей (`- name: web`);
 *   — числа, `true`/`false`, строки с кавычками и без;
 *   — комментарии с `#`.
 *
 * Всё остальное — беда с номером строки и объяснением. Молча проглоченная
 * строка хуже отказа: читатель будет искать ошибку в кластере, а она в
 * пробеле.
 */

export interface Posizione {
  /** Номер строки, начиная с единицы: он показывается читателю. */
  readonly line: number;
}

export type Valore =
  | ({ readonly kind: 'map'; readonly entries: readonly (readonly [string, Valore])[] } & Posizione)
  | ({ readonly kind: 'list'; readonly items: readonly Valore[] } & Posizione)
  | ({ readonly kind: 'scalar'; readonly value: string | number | boolean; readonly raw: string } & Posizione);

export interface Guasto extends Posizione {
  readonly text: string;
}

export interface Lettura {
  readonly doc?: Valore;
  readonly problems: readonly Guasto[];
}

interface Строка {
  readonly n: number;
  readonly отступ: number;
  readonly текст: string;
  /** Строка начинала пункт списка. Дефис превращён в отступ — см. ниже. */
  readonly дефис: boolean;
}

/** Убрать комментарий, не тронув решётку внутри кавычек. */
function безКомментария(s: string): string {
  let в: '"' | "'" | null = null;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i]!;
    if (в) {
      if (c === в) в = null;
      continue;
    }
    if (c === '"' || c === "'") {
      в = c;
      continue;
    }
    if (c === '#') return s.slice(0, i);
  }
  return s;
}

/** Разобрать скаляр: число, логическое или строка. */
function скаляр(raw: string, line: number): Valore {
  const t = raw.trim();
  if ((t.startsWith('"') && t.endsWith('"') && t.length > 1) || (t.startsWith("'") && t.endsWith("'") && t.length > 1)) {
    return { kind: 'scalar', value: t.slice(1, -1), raw: t, line };
  }
  if (t === 'true' || t === 'false') return { kind: 'scalar', value: t === 'true', raw: t, line };
  /* Число — только простое: манифест не место для степеней и шестнадцатеричных.
     «500m» и «512Mi» числами не считаются нарочно: это величины Kubernetes со
     своими единицами, и разбирать их должен тот, кто знает предмет. */
  if (/^-?\d+(\.\d+)?$/.test(t)) return { kind: 'scalar', value: Number(t), raw: t, line };
  return { kind: 'scalar', value: t, raw: t, line };
}

/**
 * Разбор.
 *
 * Приём, на котором всё держится: **дефис превращается в отступ**. Строка
 * `  - name: web` при отступе 2 становится строкой `name: web` при отступе 4
 * с пометкой «здесь начался пункт». После этого список и запись разбираются
 * одним и тем же правилом — «строки с одинаковым отступом», — а вложенность
 * считается только по отступу.
 *
 * Первая попытка разбирала список отдельно и вручную двигала указатель; она
 * теряла строку после каждого вложенного блока, и `metadata` съедала
 * половину `spec`. Такую ошибку легко не заметить: манифест разбирается,
 * беды нет, а кластер получается не тот.
 */
export function leggi(yaml: string): Lettura {
  const беды: Guasto[] = [];
  const строки: Строка[] = [];

  yaml.split('\n').forEach((сырая, i) => {
    if (сырая.includes('\t')) {
      беды.push({ line: i + 1, text: 'табуляция: YAML понимает только пробелы' });
    }
    const без = безКомментария(сырая.replace(/\t/g, '  '));
    if (без.trim() === '') return;
    const отступ = без.length - без.trimStart().length;
    const текст = без.trim();
    if (текст === '-' || текст.startsWith('- ')) {
      строки.push({ n: i + 1, отступ: отступ + 2, текст: текст === '-' ? '' : текст.slice(2).trim(), дефис: true });
      return;
    }
    строки.push({ n: i + 1, отступ, текст, дефис: false });
  });

  if (строки.length === 0) return { problems: беды };

  let i = 0;

  function блок(отступ: number): Valore {
    return строки[i]!.дефис ? список(отступ) : запись(отступ);
  }

  function список(отступ: number): Valore {
    const line = строки[i]!.n;
    const items: Valore[] = [];
    while (i < строки.length && строки[i]!.отступ === отступ && строки[i]!.дефис) {
      const с = строки[i]!;
      if (с.текст === '') {
        /* `-` сам по себе: содержимое пункта идёт ниже с большим отступом. */
        i += 1;
        if (i < строки.length && строки[i]!.отступ > отступ) items.push(блок(строки[i]!.отступ));
        else беды.push({ line: с.n, text: 'пункт списка пуст' });
        continue;
      }
      if (!раздел(с.текст)) {
        items.push(скаляр(с.текст, с.n));
        i += 1;
        continue;
      }
      /* Пункт-запись: первая строка с дефисом, продолжение — без него на том
         же отступе. Дальше работает обычный разбор записи. */
      items.push(запись(отступ, true));
    }
    return { kind: 'list', items, line };
  }

  /**
   * Запись — строки с одинаковым отступом. `внутриПункта` разрешает первой
   * строке иметь дефис (это начало пункта списка) и запрещает всем
   * последующим: следующий дефис означает следующий пункт, а не продолжение.
   */
  function запись(отступ: number, внутриПункта = false): Valore {
    const line = строки[i]!.n;
    const записи: [string, Valore][] = [];
    let первая = true;
    while (i < строки.length) {
      const с = строки[i]!;
      if (с.отступ < отступ) break;
      if (с.дефис && !(внутриПункта && первая)) break;
      if (с.отступ > отступ) {
        беды.push({ line: с.n, text: 'лишний отступ: строка глубже, чем предыдущая' });
        i += 1;
        continue;
      }
      первая = false;

      const р = раздел(с.текст);
      if (!р) {
        беды.push({ line: с.n, text: 'не разобрать строку: ожидалось «ключ: значение»' });
        i += 1;
        continue;
      }
      const [ключ, значение] = р;
      if (значение !== '') {
        записи.push([ключ, скаляр(значение, с.n)]);
        i += 1;
        continue;
      }

      /* Значение — вложенный блок. Он идёт ниже: либо с большим отступом,
         либо списком, чей дефис отступ уже увеличил. */
      i += 1;
      const след = строки[i];
      if (след && след.отступ > отступ) {
        записи.push([ключ, блок(след.отступ)]);
        continue;
      }
      беды.push({ line: с.n, text: `у поля «${ключ}» нет значения` });
    }
    return { kind: 'map', entries: записи, line };
  }

  const doc = блок(строки[0]!.отступ);
  if (i < строки.length) {
    беды.push({ line: строки[i]!.n, text: 'строка не на своём отступе' });
  }
  return { doc, problems: беды };
}

/** Разделить `ключ: значение`, не спутав двоеточие внутри значения. */
function раздел(текст: string): [string, string] | undefined {
  let в: '"' | "'" | null = null;
  for (let i = 0; i < текст.length; i += 1) {
    const c = текст[i]!;
    if (в) {
      if (c === в) в = null;
      continue;
    }
    if (c === '"' || c === "'") {
      в = c;
      continue;
    }
    if (c === ':' && (i + 1 === текст.length || текст[i + 1] === ' ')) {
      return [текст.slice(0, i).trim(), текст.slice(i + 1).trim()];
    }
  }
  return undefined;
}

/* ── чтение разобранного ──────────────────────────────────────────────
   Пути вида `spec.replicas` и `spec.template.spec.containers.0.image`.
   Нужно ровно для того, чтобы правила проверки читались как правила, а не
   как обход дерева. */

export function vai(значение: Valore | undefined, путь: string): Valore | undefined {
  if (!значение) return undefined;
  if (путь === '') return значение;
  const [шаг, ...остаток] = путь.split('.');
  const дальше = остаток.join('.');
  if (значение.kind === 'map') {
    const найдено = значение.entries.find(([k]) => k === шаг);
    return найдено ? vai(найдено[1], дальше) : undefined;
  }
  if (значение.kind === 'list') {
    const n = Number(шаг);
    if (!Number.isInteger(n)) return undefined;
    return vai(значение.items[n], дальше);
  }
  return undefined;
}

export function testo(значение: Valore | undefined): string | undefined {
  if (!значение || значение.kind !== 'scalar') return undefined;
  return typeof значение.value === 'string' ? значение.value : String(значение.value);
}

export function numero(значение: Valore | undefined): number | undefined {
  if (!значение || значение.kind !== 'scalar') return undefined;
  return typeof значение.value === 'number' ? значение.value : undefined;
}

/** Все ключи записи по порядку — для проверки на незнакомые поля. */
export function chiavi(значение: Valore | undefined): string[] {
  return значение && значение.kind === 'map' ? значение.entries.map(([k]) => k) : [];
}

/** Метки как простой набор пар: `app: web` под `labels`. */
export function etichette(значение: Valore | undefined): Record<string, string> {
  const из: Record<string, string> = {};
  if (!значение || значение.kind !== 'map') return из;
  for (const [k, v] of значение.entries) {
    const t = testo(v);
    if (t !== undefined) из[k] = t;
  }
  return из;
}

/**
 * Расстояние правки — для подсказки «вы имели в виду `replicas`?».
 *
 * Опечатка в имени поля — самая частая беда начинающего, и настоящий
 * apiserver на неё отвечает молчанием: незнакомое поле он просто
 * отбрасывает. Здесь наоборот: называем и предлагаем близкое.
 */
export function vicino(слово: string, среди: readonly string[]): string | undefined {
  let лучшее: string | undefined;
  let мера = Infinity;
  for (const кандидат of среди) {
    const d = расстояние(слово.toLowerCase(), кандидат.toLowerCase());
    if (d < мера) {
      мера = d;
      лучшее = кандидат;
    }
  }
  /* Предлагаем только правда близкое: «вы имели в виду containers?» на
     слово «xyz» — это шум, а не помощь. */
  return мера <= Math.max(1, Math.floor(слово.length / 3)) ? лучшее : undefined;
}

function расстояние(a: string, b: string): number {
  const пред = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let угол = пред[0]!;
    пред[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const было = пред[j]!;
      пред[j] = Math.min(
        пред[j]! + 1,
        пред[j - 1]! + 1,
        угол + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      угол = было;
    }
  }
  return пред[b.length]!;
}
