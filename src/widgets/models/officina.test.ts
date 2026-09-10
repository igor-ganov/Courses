import { describe, expect, it } from 'vitest';
import { cpuOf, LIVELLI, memOf, valuta, type Livello } from './officina';

/* Мастерская — не показ, а задача с правильным ответом. Значит проверяется
   двоякое: что начальный манифест уровня задачу НЕ решает (иначе уровень
   решён до того, как читатель что-то сделал), и что задуманное решение её
   решает (иначе уровень нерешаем, а выглядит обычным).

   Ровно эти две проверки и делают набор уровней набором, а не россыпью
   текстов. */

const уровень = (id: string): Livello => LIVELLI.find((l) => l.id === id)!;

describe('величины Kubernetes', () => {
  it('ядра: «500m» — половина, «2» — два', () => {
    expect(cpuOf('500m')).toBe(0.5);
    expect(cpuOf('2')).toBe(2);
    expect(cpuOf('1500m')).toBe(1.5);
  });

  it('память: «512Mi» — полгига, «1Gi» — гиг', () => {
    expect(memOf('512Mi')).toBe(0.5);
    expect(memOf('1Gi')).toBe(1);
    expect(memOf('2Gi')).toBe(2);
  });

  it('без единицы это байты, а не гигабайты', () => {
    /* Самая дорогая опечатка в заявках: «512» вместо «512Mi». Узел её
       примет, а программа умрёт от нехватки памяти. */
    expect(memOf('512')).toBeLessThan(0.000001);
  });

  it('чепуха не проходит', () => {
    expect(cpuOf('много')).toBeUndefined();
    expect(memOf('512 Mi')).toBeUndefined();
    expect(memOf('пол')).toBeUndefined();
  });
});

describe('каждый уровень — задача', () => {
  it('начальный манифест ни одного уровня не решает', () => {
    for (const l of LIVELLI) {
      const q = valuta(l.start, l);
      expect(l.check(q).done, `${l.id} решён сразу`).toBe(false);
    }
  });

  it('и у каждого есть внятная причина, почему пока нет', () => {
    for (const l of LIVELLI) {
      const q = valuta(l.start, l);
      /* «Неверно» — не объяснение. Причина должна называть, что именно не
         так, и быть длиннее короткого отказа. */
      expect(l.check(q).why.length, l.id).toBeGreaterThan(20);
    }
  });
});

describe('уровень: пусть будет три', () => {
  const l = уровень('replicas');

  it('решается правкой одного числа', () => {
    const q = valuta(l.start.replace('replicas: 1', 'replicas: 3'), l);
    expect(l.check(q).done).toBe(true);
    expect(q.pods.filter((p) => p.node)).toHaveLength(3);
  });

  it('перебор тоже не решение', () => {
    const q = valuta(l.start.replace('replicas: 1', 'replicas: 5'), l);
    expect(l.check(q).done).toBe(false);
    expect(l.check(q).why).toContain('больше');
  });
});

describe('уровень: опечатка', () => {
  const l = уровень('opechatka');

  it('незнакомое поле названо, и близкое предложено', () => {
    const q = valuta(l.start, l);
    expect(q.problems.some((p) => p.text.includes('replicas'))).toBe(true);
  });

  it('решается исправлением имени поля', () => {
    const q = valuta(l.start.replace('replica: 3', 'replicas: 3'), l);
    expect(l.check(q).done).toBe(true);
  });
});

describe('уровень: служба никого не находит', () => {
  const l = уровень('selettore');

  it('поды работают, а служба пуста', () => {
    const q = valuta(l.start, l);
    expect(q.pods.filter((p) => p.node)).toHaveLength(3);
    expect(q.service!.endpoints).toHaveLength(0);
  });

  it('причина называет и то, что ищет служба, и то, что есть у пода', () => {
    const {

      why } = l.check(valuta(l.start, l));
    expect(why).toContain('app=web');
    expect(why).toContain('app=frontend');
  });

  it('решается совпадением метки', () => {
    const q = valuta(l.start.replace('app: frontend', 'app: web'), l);
    expect(l.check(q).done).toBe(true);
    expect(q.service!.endpoints).toHaveLength(3);
  });
});

describe('уровень: не влезли', () => {
  const l = уровень('risorse');

  it('на узле места меньше, чем просят', () => {
    const q = valuta(l.start, l);
    expect(q.pods.filter((p) => p.node).length).toBeLessThan(3);
    expect(q.pods.find((p) => p.perche)!.perche).toContain('нет узла');
  });

  it('решается уменьшением заявки', () => {
    const yaml = l.start.replace('cpu: "1"', 'cpu: 500m').replace('memory: 2Gi', 'memory: 1Gi');
    const q = valuta(yaml, l);
    expect(l.check(q).done).toBe(true);
    expect(q.pods.filter((p) => p.node)).toHaveLength(3);
  });

  it('но заниженная заявка не считается решением', () => {
    /* Иначе читатель «решает» уровень, убрав заявку совсем, и уносит с
       собой ровно неверный вывод. */
    const yaml = l.start.replace('cpu: "1"', 'cpu: 1m').replace('memory: 2Gi', 'memory: 1Mi');
    const q = valuta(yaml, l);
    const э = l.check(q);
    expect(э.done).toBe(false);
    expect(э.why).toContain('занижена');
  });

  it('и убранная заявка тоже', () => {
    const yaml = l.start.replace(/          resources:[\s\S]*$/, '');
    const q = valuta(yaml, l);
    expect(l.check(q).done).toBe(false);
  });
});

describe('уровень: второй контейнер', () => {
  const l = уровень('due');

  it('решается вторым контейнером с общим томом', () => {
    const yaml = `apiVersion: apps/v1
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
      volumes:
        - name: logs
      containers:
        - name: web
          image: nginx:1.27
          volumeMounts:
            - name: logs
        - name: shipper
          image: fluent-bit:3.1
          volumeMounts:
            - name: logs
`;
    const q = valuta(yaml, l);
    expect(q.problems).toEqual([]);
    expect(q.containers).toHaveLength(2);
    expect(l.check(q).done).toBe(true);
  });

  it('том, который монтируют, но не объявляют, — отдельная беда с объяснением', () => {
    const yaml = `apiVersion: apps/v1
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
        - name: shipper
          image: fluent-bit:3.1
          volumeMounts:
            - name: logs
`;
    const э = l.check(valuta(yaml, l));
    expect(э.done).toBe(false);
    expect(э.why).toContain('volumes');
  });

  it('второй контейнер без общего тома не решение', () => {
    const yaml = l.start.replace(
      '          volumeMounts:\n            - name: logs\n',
      '          volumeMounts:\n            - name: logs\n        - name: shipper\n          image: fluent-bit:3.1\n',
    );
    const э = l.check(valuta(yaml, l));
    expect(э.done).toBe(false);
    expect(э.why).toContain('logs');
  });
});

describe('приёмка', () => {
  const l = уровень('replicas');

  it('отбор набора обязан совпадать с метками шаблона', () => {
    const yaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 1
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.27
`;
    const q = valuta(yaml, l);
    expect(q.problems.some((p) => p.text.includes('отбор набора'))).toBe(true);
  });

  it('не тот apiVersion назван прямо', () => {
    const q = valuta(l.start.replace('apps/v1', 'v1'), l);
    expect(q.problems.some((p) => p.text.includes('apps/v1'))).toBe(true);
  });

  it('строка вместо числа в replicas — беда', () => {
    const q = valuta(l.start.replace('replicas: 1', 'replicas: "три"'), l);
    expect(q.problems.some((p) => p.text.includes('число'))).toBe(true);
  });

  it('пока манифест не принят, кластера нет вовсе', () => {
    const q = valuta(l.start.replace('kind: Deployment', 'kind: Deploymnt'), l);
    expect(q.pods).toHaveLength(0);
    expect(l.check(q).why).toContain('не принят');
  });

  it('беды идут сверху вниз по манифесту', () => {
    const q = valuta('kind: Deploymnt\nspec:\n  replicas: "три"\n', l);
    const строки = q.problems.map((p) => p.line);
    expect([...строки].sort((a, b) => a - b)).toEqual(строки);
  });
});
