import { describe, expect, it } from 'vitest';
import { chiavi, etichette, leggi, numero, testo, vai, vicino } from './yaml';

/* Разбор — основание мастерской: читатель пишет настоящий манифест, и от
   разбора зависит, увидит он внятную беду с номером строки или молчание.
   Поэтому проверяется и то, что разбирается, и то, что отвергается. */

const М = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  labels:
    app: web
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
        release: stable
    spec:
      containers:
        - name: web
          image: nginx:1.27
          resources:
            requests:
              cpu: "500m"
              memory: 512Mi
`;

describe('разбор манифеста', () => {
  const { doc, problems } = leggi(М);

  it('проходит без бед', () => {
    expect(problems).toEqual([]);
  });

  it('читает вложенное по пути', () => {
    expect(testo(vai(doc, 'kind'))).toBe('Deployment');
    expect(testo(vai(doc, 'metadata.name'))).toBe('web');
    expect(numero(vai(doc, 'spec.replicas'))).toBe(3);
  });

  it('читает список записей', () => {
    expect(testo(vai(doc, 'spec.template.spec.containers.0.name'))).toBe('web');
    expect(testo(vai(doc, 'spec.template.spec.containers.0.image'))).toBe('nginx:1.27');
  });

  it('не путает двоеточие внутри значения', () => {
    /* `nginx:1.27` — одно значение, а не ключ с значением. Ошибка здесь
       превратила бы каждый образ в поле. */
    expect(testo(vai(doc, 'spec.template.spec.containers.0.image'))).toContain(':');
  });

  it('снимает кавычки, но не трогает величины Kubernetes', () => {
    expect(testo(vai(doc, 'spec.template.spec.containers.0.resources.requests.cpu'))).toBe('500m');
    expect(testo(vai(doc, 'spec.template.spec.containers.0.resources.requests.memory'))).toBe('512Mi');
    /* Числами они не считаются нарочно: это величины со своими единицами. */
    expect(numero(vai(doc, 'spec.template.spec.containers.0.resources.requests.cpu'))).toBeUndefined();
  });

  it('собирает метки набором пар', () => {
    expect(etichette(vai(doc, 'spec.template.metadata.labels'))).toEqual({
      app: 'web',
      release: 'stable',
    });
  });

  it('перечисляет ключи по порядку — для проверки на незнакомые поля', () => {
    expect(chiavi(vai(doc, 'metadata'))).toEqual(['name', 'labels']);
  });
});

describe('значения', () => {
  it('числа, логические и строки различаются', () => {
    const { doc } = leggi('a: 3\nb: true\nc: web\nd: "3"');
    expect(numero(vai(doc, 'a'))).toBe(3);
    expect(testo(vai(doc, 'b'))).toBe('true');
    expect(testo(vai(doc, 'c'))).toBe('web');
    /* Строка в кавычках остаётся строкой: `"3"` — не три. */
    expect(numero(vai(doc, 'd'))).toBeUndefined();
    expect(testo(vai(doc, 'd'))).toBe('3');
  });

  it('комментарии выброшены, а решётка в кавычках — нет', () => {
    const { doc, problems } = leggi('a: 1 # это счёт\nb: "цвет #ff0000"');
    expect(problems).toEqual([]);
    expect(numero(vai(doc, 'a'))).toBe(1);
    expect(testo(vai(doc, 'b'))).toBe('цвет #ff0000');
  });

  it('пустые строки ничего не ломают', () => {
    const { doc, problems } = leggi('a: 1\n\n\nb: 2\n');
    expect(problems).toEqual([]);
    expect(numero(vai(doc, 'b'))).toBe(2);
  });
});

describe('беды с номером строки', () => {
  it('табуляция названа прямо', () => {
    const { problems } = leggi('a: 1\n\tb: 2');
    expect(problems[0]!.line).toBe(2);
    expect(problems[0]!.text).toContain('табуляция');
  });

  it('ключ без значения — беда, а не пустое место', () => {
    const { problems } = leggi('metadata:\nkind: Pod');
    expect(problems.some((p) => p.line === 1 && p.text.includes('metadata'))).toBe(true);
  });

  it('строка без двоеточия названа с номером', () => {
    const { problems } = leggi('kind: Pod\nprosto tekst');
    expect(problems.some((p) => p.line === 2)).toBe(true);
  });

  it('лишний отступ виден', () => {
    const { problems } = leggi('a: 1\n    b: 2\nc: 3');
    expect(problems.some((p) => p.line === 2 && p.text.includes('отступ'))).toBe(true);
  });

  it('пустой ввод не роняет разбор', () => {
    expect(leggi('').problems).toEqual([]);
    expect(leggi('   \n\n').doc).toBeUndefined();
  });
});

describe('список на том же отступе, что ключ', () => {
  it('разбирается: так пишут contейнеры без сдвига', () => {
    const { doc, problems } = leggi('spec:\n  containers:\n  - name: web\n    image: nginx\n');
    expect(problems).toEqual([]);
    expect(testo(vai(doc, 'spec.containers.0.image'))).toBe('nginx');
  });
});

describe('подсказка по опечатке', () => {
  it('предлагает близкое', () => {
    expect(vicino('replica', ['replicas', 'selector', 'template'])).toBe('replicas');
    expect(vicino('metadta', ['metadata', 'spec', 'kind'])).toBe('metadata');
  });

  it('и молчит, когда близкого нет', () => {
    expect(vicino('квартира', ['replicas', 'selector'])).toBeUndefined();
  });
});
