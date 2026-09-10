/**
 * МАСТЕРСКАЯ — читатель пишет настоящий манифест, кластер отвечает.
 *
 * Устройство взято у CSS Grid Garden и у схемных тренажёров, и взято
 * сознательно: там учат не вопросами, а работой. Пишешь настоящий синтаксис
 * — грядка сразу перестраивается; ставишь на схему резистор — ток
 * пересчитывается. Задача уровня сформулирована словами, проверяет её сама
 * обстановка, а не тест с четырьмя вариантами.
 *
 * Здесь то же самое, только предмет другой:
 *
 *   — читатель правит YAML, а не двигает ползунки. Это буквально то, чем
 *     занимаются вокруг Kubernetes;
 *   — манифест проходит приёмку, как у apiserver: незнакомое поле, не тот
 *     вид значения, отсутствие обязательного — беда с номером строки. С
 *     подсказкой: настоящий apiserver незнакомое поле молча отбрасывает,
 *     и на этом теряют часы;
 *   — принятый манифест превращается в кластер: поды раскладываются по
 *     узлам по заявкам, служба находит их по метке. Всё, что читатель
 *     видит, — следствие того, что он написал;
 *   — задача уровня проверяется по получившемуся кластеру, и при неудаче
 *     говорит, что именно не так, а не «неверно».
 *
 * Модель чистая и без экрана: её гоняют тесты, а виджет только рисует.
 */

import { chiavi, etichette, leggi, numero, testo, vai, vicino, type Guasto, type Valore } from './yaml';

export interface Nodo {
  readonly name: string;
  /** Ядра. */
  readonly cpu: number;
  /** Гигабайты. */
  readonly mem: number;
}

export interface PodPiazzato {
  readonly name: string;
  /** Узел, если разместился. */
  readonly node?: string;
  /** Почему не разместился — словами. */
  readonly perche?: string;
  readonly labels: Readonly<Record<string, string>>;
  readonly cpu: number;
  readonly mem: number;
  /** Попал ли под в службу этого уровня. */
  readonly served: boolean;
}

export interface Servizio {
  readonly name: string;
  readonly selector: Readonly<Record<string, string>>;
  readonly endpoints: readonly string[];
}

/** Картина кластера — всё, что читатель видит после правки манифеста. */
export interface Quadro {
  readonly problems: readonly Guasto[];
  readonly replicas: number;
  readonly labels: Readonly<Record<string, string>>;
  readonly containers: readonly { readonly name: string; readonly image: string; readonly mounts: readonly string[] }[];
  readonly volumes: readonly string[];
  readonly requests: { readonly cpu: number; readonly mem: number };
  readonly nodes: readonly Nodo[];
  readonly pods: readonly PodPiazzato[];
  readonly service?: Servizio;
  /** Свободное место на узлах после раскладки. */
  readonly libero: readonly { readonly name: string; readonly cpu: number; readonly mem: number }[];
}

export interface Esito {
  readonly done: boolean;
  /** Что именно не так — или что получилось. Не «неверно». */
  readonly why: string;
}

export interface Livello {
  readonly id: string;
  readonly title: string;
  /** Задача словами. Читатель должен понять её без манифеста. */
  readonly task: string;
  readonly start: string;
  readonly nodes: readonly Nodo[];
  /** Служба уровня: её селектор задан заранее и читателю не принадлежит. */
  readonly service?: { readonly name: string; readonly selector: Readonly<Record<string, string>> };
  /** Чужие поды: они уже стоят и занимают место. */
  readonly foreign?: readonly { readonly name: string; readonly node: string; readonly cpu: number; readonly mem: number }[];
  readonly check: (q: Quadro) => Esito;
}

/* ── величины Kubernetes ──────────────────────────────────────────────── */

/** `500m` → 0,5; `2` → 2. Ядра. */
export function cpuOf(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const t = raw.trim();
  if (/^\d+(\.\d+)?m$/.test(t)) return Number(t.slice(0, -1)) / 1000;
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  return undefined;
}

/** `512Mi` → 0,5; `1Gi` → 1; `2G` → 1,86. Гигабайты. */
export function memOf(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const t = raw.trim();
  const m = /^(\d+(?:\.\d+)?)(Ki|Mi|Gi|Ti|K|M|G|T)?$/.exec(t);
  if (!m) return undefined;
  const n = Number(m[1]);
  const множ: Record<string, number> = {
    Ki: 1 / 1024 / 1024,
    Mi: 1 / 1024,
    Gi: 1,
    Ti: 1024,
    K: 1e3 / 2 ** 30,
    M: 1e6 / 2 ** 30,
    G: 1e9 / 2 ** 30,
    T: 1e12 / 2 ** 30,
  };
  const е = m[2];
  /* Без единицы Kubernetes считает байты. Заявка «512» — это полкилобайта,
     и почти всегда это опечатка вместо `512Mi`; такую заявку узел примет и
     программа умрёт от нехватки памяти. Поэтому считаем честно. */
  return е ? n * множ[е]! : n / 2 ** 30;
}

/* ── приёмка ──────────────────────────────────────────────────────────── */

const ПОЛЯ: Record<string, readonly string[]> = {
  '': ['apiVersion', 'kind', 'metadata', 'spec'],
  metadata: ['name', 'labels', 'annotations'],
  spec: ['replicas', 'selector', 'template', 'strategy'],
  'spec.selector': ['matchLabels'],
  'spec.template': ['metadata', 'spec'],
  'spec.template.metadata': ['labels', 'annotations'],
  'spec.template.spec': ['containers', 'volumes', 'nodeSelector', 'tolerations'],
};

const ПОЛЯ_КОНТЕЙНЕРА = ['name', 'image', 'resources', 'ports', 'volumeMounts', 'env'] as const;

/** Незнакомые поля — с подсказкой по близкому имени. */
function незнакомые(doc: Valore | undefined, беды: Guasto[]): void {
  for (const [путь, известные] of Object.entries(ПОЛЯ)) {
    const узел = vai(doc, путь);
    if (!узел || узел.kind !== 'map') continue;
    for (const [ключ, значение] of узел.entries) {
      if (известные.includes(ключ)) continue;
      const близкое = vicino(ключ, известные);
      беды.push({
        line: значение.line,
        text: близкое
          ? `поля «${ключ}» нет — вы имели в виду «${близкое}»?`
          : `поля «${ключ}» здесь нет`,
      });
    }
  }
  const контейнеры = vai(doc, 'spec.template.spec.containers');
  if (контейнеры && контейнеры.kind === 'list') {
    контейнеры.items.forEach((к) => {
      for (const ключ of chiavi(к)) {
        if ((ПОЛЯ_КОНТЕЙНЕРА as readonly string[]).includes(ключ)) continue;
        const близкое = vicino(ключ, ПОЛЯ_КОНТЕЙНЕРА);
        беды.push({
          line: к.line,
          text: близкое
            ? `в контейнере нет поля «${ключ}» — вы имели в виду «${близкое}»?`
            : `в контейнере нет поля «${ключ}»`,
        });
      }
    });
  }
}

/** Обязательное и виды значений. Порядок бед — сверху вниз по манифесту. */
function приёмка(doc: Valore | undefined): Guasto[] {
  const беды: Guasto[] = [];
  if (!doc || doc.kind !== 'map') {
    return [{ line: 1, text: 'манифест пуст: нужен объект с apiVersion, kind, metadata и spec' }];
  }

  const версия = testo(vai(doc, 'apiVersion'));
  if (версия === undefined) беды.push({ line: doc.line, text: 'нет поля apiVersion' });
  else if (версия !== 'apps/v1') {
    беды.push({ line: vai(doc, 'apiVersion')!.line, text: `Deployment живёт в apps/v1, а не в «${версия}»` });
  }

  const вид = testo(vai(doc, 'kind'));
  if (вид === undefined) беды.push({ line: doc.line, text: 'нет поля kind' });
  else if (вид !== 'Deployment') {
    беды.push({ line: vai(doc, 'kind')!.line, text: `здесь ожидается kind: Deployment, а не «${вид}»` });
  }

  if (testo(vai(doc, 'metadata.name')) === undefined) {
    беды.push({ line: (vai(doc, 'metadata') ?? doc).line, text: 'у объекта нет metadata.name' });
  }

  const реплики = vai(doc, 'spec.replicas');
  if (реплики) {
    const n = numero(реплики);
    if (n === undefined) {
      беды.push({ line: реплики.line, text: 'replicas — число, а не строка' });
    } else if (!Number.isInteger(n) || n < 0) {
      беды.push({ line: реплики.line, text: 'replicas — целое неотрицательное' });
    } else if (n > 12) {
      беды.push({ line: реплики.line, text: 'больше двенадцати на эту обстановку не поместится' });
    }
  }

  const шаблон = vai(doc, 'spec.template');
  if (!шаблон) {
    беды.push({ line: (vai(doc, 'spec') ?? doc).line, text: 'нет spec.template: описания пода, который надо создавать' });
  }

  const контейнеры = vai(doc, 'spec.template.spec.containers');
  if (!контейнеры) {
    if (шаблон) беды.push({ line: шаблон.line, text: 'нет spec.template.spec.containers' });
  } else if (контейнеры.kind !== 'list') {
    беды.push({ line: контейнеры.line, text: 'containers — список: каждый пункт начинается с «- »' });
  } else if (контейнеры.items.length === 0) {
    беды.push({ line: контейнеры.line, text: 'containers пуст: поду нечего запускать' });
  } else {
    контейнеры.items.forEach((к) => {
      if (testo(vai(к, 'name')) === undefined) беды.push({ line: к.line, text: 'у контейнера нет name' });
      if (testo(vai(к, 'image')) === undefined) беды.push({ line: к.line, text: 'у контейнера нет image' });
      const заявка = vai(к, 'resources.requests');
      if (заявка) {
        const c = vai(заявка, 'cpu');
        const m = vai(заявка, 'memory');
        if (c && cpuOf(testo(c)) === undefined) {
          беды.push({ line: c.line, text: 'cpu пишется как «500m» или «2»' });
        }
        if (m && memOf(testo(m)) === undefined) {
          беды.push({ line: m.line, text: 'memory пишется как «512Mi» или «1Gi»' });
        }
      }
    });
  }

  /* Отбор Deployment обязан совпадать с метками шаблона — иначе он не
     считает своими те поды, которые сам же создал. Настоящий apiserver
     отказывает ровно так же. */
  const отбор = etichette(vai(doc, 'spec.selector.matchLabels'));
  const метки = etichette(vai(doc, 'spec.template.metadata.labels'));
  if (Object.keys(отбор).length > 0) {
    const не = Object.entries(отбор).filter(([k, v]) => метки[k] !== v);
    if (не.length > 0) {
      беды.push({
        line: vai(doc, 'spec.selector.matchLabels')!.line,
        text: `отбор набора не совпадает с метками шаблона: ${не
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')} — таких меток у пода нет`,
      });
    }
  }

  незнакомые(doc, беды);
  return беды.sort((a, b) => a.line - b.line);
}

/* ── расчёт кластера ──────────────────────────────────────────────────── */

const подходит = (свободно: { cpu: number; mem: number }, p: { cpu: number; mem: number }) =>
  свободно.cpu >= p.cpu - 1e-9 && свободно.mem >= p.mem - 1e-9;

export function valuta(yaml: string, уровень: Livello): Quadro {
  const { doc, problems } = leggi(yaml);
  const беды = [...problems, ...(problems.length > 0 ? [] : приёмка(doc))];

  const метки = etichette(vai(doc, 'spec.template.metadata.labels'));
  const списокКонтейнеров = vai(doc, 'spec.template.spec.containers');
  const контейнеры =
    списокКонтейнеров && списокКонтейнеров.kind === 'list'
      ? списокКонтейнеров.items.map((к) => ({
          name: testo(vai(к, 'name')) ?? '',
          image: testo(vai(к, 'image')) ?? '',
          mounts: (() => {
            const м = vai(к, 'volumeMounts');
            if (!м || м.kind !== 'list') return [] as string[];
            return м.items.map((x) => testo(vai(x, 'name')) ?? '').filter(Boolean);
          })(),
        }))
      : [];

  const списокТомов = vai(doc, 'spec.template.spec.volumes');
  const тома =
    списокТомов && списокТомов.kind === 'list'
      ? списокТомов.items.map((т) => testo(vai(т, 'name')) ?? '').filter(Boolean)
      : [];

  /* Заявка пода — сумма заявок его контейнеров: узел выделяет место поду
     целиком, а не каждому контейнеру по отдельности. */
  let cpu = 0;
  let mem = 0;
  if (списокКонтейнеров && списокКонтейнеров.kind === 'list') {
    for (const к of списокКонтейнеров.items) {
      cpu += cpuOf(testo(vai(к, 'resources.requests.cpu'))) ?? 0;
      mem += memOf(testo(vai(к, 'resources.requests.memory'))) ?? 0;
    }
  }

  const реплики = беды.length > 0 ? 0 : (numero(vai(doc, 'spec.replicas')) ?? 1);
  const имя = testo(vai(doc, 'metadata.name')) ?? 'web';

  const свободно = уровень.nodes.map((n) => ({ name: n.name, cpu: n.cpu, mem: n.mem }));
  for (const ч of уровень.foreign ?? []) {
    const узел = свободно.find((s) => s.name === ч.node);
    if (узел) {
      узел.cpu -= ч.cpu;
      узел.mem -= ч.mem;
    }
  }

  const поды: PodPiazzato[] = [];
  for (let k = 0; k < реплики; k += 1) {
    const имяПода = `${имя}-${ХВОСТЫ[k % ХВОСТЫ.length]}`;
    /* Раскладка та же, что у планировщика: отсев по вместимости, выбор — где
       свободнее. Подробности разбирает отдельный прибор; здесь важно, что
       место считается по заявкам, а не по потреблению. */
    let лучший = -1;
    let лучше = -1;
    свободно.forEach((s, i) => {
      if (!подходит(s, { cpu, mem })) return;
      const оценка = (s.cpu - cpu) / Math.max(уровень.nodes[i]!.cpu, 0.001) + (s.mem - mem) / Math.max(уровень.nodes[i]!.mem, 0.001);
      if (оценка > лучше) {
        лучше = оценка;
        лучший = i;
      }
    });
    if (лучший < 0) {
      const нужно: string[] = [];
      if (!свободно.some((s) => s.cpu >= cpu - 1e-9)) нужно.push(`${cpu} ядра`);
      if (!свободно.some((s) => s.mem >= mem - 1e-9)) нужно.push(`${mem.toFixed(2)} ГБ памяти`);
      поды.push({
        name: имяПода,
        perche: нужно.length > 0 ? `нет узла с ${нужно.join(' и ')}` : 'ни на одном узле не осталось места',
        labels: метки,
        cpu,
        mem,
        served: false,
      });
      continue;
    }
    свободно[лучший]!.cpu -= cpu;
    свободно[лучший]!.mem -= mem;
    поды.push({ name: имяПода, node: свободно[лучший]!.name, labels: метки, cpu, mem, served: false });
  }

  let служба: Servizio | undefined;
  if (уровень.service) {
    const подходят = поды
      .filter((p) => p.node !== undefined)
      .filter((p) => Object.entries(уровень.service!.selector).every(([k, v]) => p.labels[k] === v))
      .map((p) => p.name);
    служба = { name: уровень.service.name, selector: уровень.service.selector, endpoints: подходят };
    for (const p of поды) {
      if (подходят.includes(p.name)) {
        (p as { served: boolean }).served = true;
      }
    }
  }

  return {
    problems: беды,
    replicas: реплики,
    labels: метки,
    containers: контейнеры,
    volumes: тома,
    requests: { cpu, mem },
    nodes: уровень.nodes,
    pods: поды,
    ...(служба ? { service: служба } : {}),
    libero: свободно.map((s) => ({ name: s.name, cpu: Number(s.cpu.toFixed(2)), mem: Number(s.mem.toFixed(2)) })),
  };
}

const ХВОСТЫ = ['a4f', 'b7k', 'c2m', 'd9p', 'e5t', 'f3w', 'g8n', 'h6r', 'j1s', 'k4v', 'm7x', 'n2z'];

/* ── уровни ───────────────────────────────────────────────────────────── */

const работают = (q: Quadro) => q.pods.filter((p) => p.node !== undefined).length;

/** Общее начало проверки: пока манифест не принят, кластера нет вовсе. */
function принят(q: Quadro): Esito | undefined {
  if (q.problems.length === 0) return undefined;
  const п = q.problems[0]!;
  return { done: false, why: `Манифест не принят. Строка ${п.line}: ${п.text}` };
}

const УЗЛЫ_ОБЫЧНЫЕ: readonly Nodo[] = [
  { name: 'узел-1', cpu: 4, mem: 8 },
  { name: 'узел-2', cpu: 4, mem: 8 },
];

export const LIVELLI: readonly Livello[] = [
  {
    id: 'replicas',
    title: 'Пусть будет три',
    task: 'Сделайте так, чтобы работали три экземпляра. Не создавайте их по одному — заявите, сколько их должно быть.',
    nodes: УЗЛЫ_ОБЫЧНЫЕ,
    start: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 1
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.27
`,
    check(q) {
      const не = принят(q);
      if (не) return не;
      const n = работают(q);
      if (n === 3) return { done: true, why: 'Три экземпляра работают. Вы не создавали ни одного — вы записали, сколько их должно быть.' };
      if (n < 3) return { done: false, why: `Работают ${n}. Загляните в spec.replicas.` };
      return { done: false, why: `Работают ${n} — это больше, чем нужно.` };
    },
  },
  {
    id: 'opechatka',
    title: 'Почему их всё ещё один',
    task: 'В манифесте заявлено три, а работает один. Найдите, почему, и починьте.',
    nodes: УЗЛЫ_ОБЫЧНЫЕ,
    start: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replica: 3
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.27
`,
    check(q) {
      const не = принят(q);
      if (не) return не;
      const n = работают(q);
      if (n === 3) {
        return {
          done: true,
          why: 'Три работают. Настоящий apiserver на такое поле отвечает молчанием: он его просто отбрасывает, и найти опечатку можно только глазами.',
        };
      }
      return { done: false, why: `Работает ${n}. Поле, которое вы правите, точно так называется?` };
    },
  },
  {
    id: 'selettore',
    title: 'Служба никого не находит',
    task: 'Служба web-svc отбирает поды по метке app=web. Поды работают, а служба пуста. Сделайте так, чтобы она нашла все три.',
    nodes: УЗЛЫ_ОБЫЧНЫЕ,
    service: { name: 'web-svc', selector: { app: 'web' } },
    start: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 3
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
        - name: web
          image: nginx:1.27
`,
    check(q) {
      const не = принят(q);
      if (не) return не;
      const найдено = q.service?.endpoints.length ?? 0;
      if (найдено === 3 && работают(q) === 3) {
        return {
          done: true,
          why: 'Служба нашла все три. Связь идёт по совпадению метки, а не по имени: список имён устарел бы через секунду.',
        };
      }
      if (работают(q) !== 3) return { done: false, why: `Работают ${работают(q)} из трёх.` };
      return {
        done: false,
        why: `Служба нашла ${найдено}. Она ищет app=web; у пода метка ${
          Object.entries(q.labels).map(([k, v]) => `${k}=${v}`).join(', ') || 'не задана'
        }.`,
      };
    },
  },
  {
    id: 'risorse',
    title: 'Три пода, которые не влезли',
    task: 'Заявлено три экземпляра, а работает меньше: каждый просит слишком много. Уменьшите заявку так, чтобы поместились все три — и не меньше 0,5 ядра и 512Mi на экземпляр.',
    nodes: [{ name: 'узел-1', cpu: 2, mem: 4 }],
    start: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 3
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.27
          resources:
            requests:
              cpu: "1"
              memory: 2Gi
`,
    check(q) {
      const не = принят(q);
      if (не) return не;
      if (работают(q) !== 3) {
        const ждёт = q.pods.find((p) => p.perche);
        return {
          done: false,
          why: `Работают ${работают(q)} из трёх${ждёт ? `: ${ждёт.perche}` : ''}. На узле 2 ядра и 4 ГБ.`,
        };
      }
      if (q.requests.cpu < 0.5 || q.requests.mem < 0.5) {
        return {
          done: false,
          why: `Влезли, но заявка занижена: ${q.requests.cpu} ядра и ${(q.requests.mem * 1024).toFixed(0)}Mi. Под без заявки почти невесом для планировщика — и узел, полупустой по учёту, задыхается.`,
        };
      }
      return {
        done: true,
        why: 'Все три помещаются. Заметьте, что считается заявка, а не потребление: узел продаёт ёмкость по обещаниям.',
      };
    },
  },
  {
    id: 'due',
    title: 'Второй контейнер в поде',
    task: 'Рядом с web нужен сборщик логов: контейнер fluent-bit:3.1 по имени shipper. Оба должны монтировать один том logs — объявите его в поде.',
    nodes: УЗЛЫ_ОБЫЧНЫЕ,
    start: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 2
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.27
          volumeMounts:
            - name: logs
`,
    check(q) {
      const не = принят(q);
      if (не) return не;
      if (q.containers.length < 2) {
        return { done: false, why: `В поде ${q.containers.length} контейнер. Нужен второй — shipper.` };
      }
      const второй = q.containers.find((к) => к.name === 'shipper');
      if (!второй) return { done: false, why: 'Второй контейнер есть, но зовут его иначе: нужен shipper.' };
      if (!второй.image.startsWith('fluent-bit')) {
        return { done: false, why: `У shipper образ «${второй.image}», а нужен fluent-bit:3.1.` };
      }
      const общий = q.containers.every((к) => к.mounts.includes('logs'));
      if (!общий) return { done: false, why: 'Том logs монтирует не каждый контейнер, а нужны оба: иначе один пишет, а второй читает пустоту.' };
      if (!q.volumes.includes('logs')) {
        return {
          done: false,
          why: 'Том logs монтируют, но нигде не объявляют. Он объявляется на уровне пода — в spec.template.spec.volumes.',
        };
      }
      if (работают(q) < 2) return { done: false, why: `Работают ${работают(q)} из двух.` };
      return {
        done: true,
        why: 'Два контейнера в одном поде, общий том, общая судьба. Программу трогать не пришлось — логи забирает сосед.',
      };
    },
  },
];
