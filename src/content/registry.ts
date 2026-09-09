/**
 * РЕЕСТР БЛОКОВ — единственная точка расширения платформы.
 *
 * Лекция здесь — дерево блоков, а блок — это данные с меткой вида. Что такое
 * «вид», движок не знает: он спрашивает реестр. Поэтому новый интерактив стоит
 * ровно трёх вещей — схема, элемент, одна регистрация, — и ни движок, ни
 * маршрутизатор, ни отображение лекции об этом не узнают.
 *
 * Схема блоков собирается ИЗ реестра, а не лежит списком в движке. Это и есть
 * то место, где абстракция либо держит, либо течёт: стоит движку завести у себя
 * перечисление видов, и каждый новый виджет начнёт стоить правки в трёх файлах.
 */

import * as s from '~/core/schema';

/** Что известно блоку при отрисовке: где он живёт и куда ведут короткие ссылки. */
export interface RenderContext {
  readonly base: string;
  readonly course: string;
}

export interface BlockDefinition<T extends { kind: string } = { kind: string }> {
  /** Метка вида: она же ключ в данных лекции. */
  readonly kind: T['kind'];
  /** Человеческое имя — для галереи блоков и сообщений автору. */
  readonly label: string;
  /** Короткое пояснение для галереи: чем этот блок отличается от соседнего. */
  readonly note?: string;
  readonly schema: s.Schema<T>;

  /* Ровно один из двух способов отрисовки.

     Текст рисуется разметкой и не стоит ни байта скрипта: набор, выделение,
     поиск по странице и печать работают сами. Заворачивать абзац в
     пользовательский элемент с теневым корнем значило бы отрезать его от
     общей типографики и от поиска ради ничего.

     Интерактив — элемент Lit с теневым корнем, и вот там инкапсуляция как раз
     к месту. Он грузится по появлению на экране, поэтому лекция без виджетов
     не платит за них. */

  /** Статический блок: разметка строится из данных и экранируется. */
  readonly html?: (block: T, context: RenderContext) => string;
  /** Интерактивный блок: имя элемента и его отложенная загрузка. */
  readonly tag?: string;
  readonly load?: () => Promise<unknown>;
}

/** Блок как его видит движок: метка вида плюс что угодно, что позволила схема. */
export type Block = { readonly kind: string } & Record<string, unknown>;

const registry = new Map<string, BlockDefinition>();

/* Схема-союз строится по реестру и кэшируется. Версия сбрасывает кэш при новой
   регистрации: порядок загрузки модулей — не то, на что стоит закладываться. */
let version = 0;
let cached: { at: number; schema: s.Schema<Block> } | undefined;

export type BlockFactory<T extends { kind: string }> = (props: Omit<T, 'kind'>) => T;

/**
 * Зарегистрировать вид блока. Возвращает фабрику: в файле курса пишут
 * `prose({ text: '…' })`, а метку вида подставляет она сама — руками её
 * дублировать незачем, и опечататься в ней негде.
 */
export function defineBlock<T extends { kind: string }>(
  definition: BlockDefinition<T>,
): BlockFactory<T> {
  if (registry.has(definition.kind)) {
    throw new Error(
      `вид блока "${definition.kind}" уже занят: молчаливая подмена блока хуже падения`,
    );
  }
  const статический = typeof definition.html === 'function';
  const интерактивный = typeof definition.tag === 'string';
  if (статический === интерактивный) {
    throw new Error(
      `блок "${definition.kind}": нужен ровно один способ отрисовки — html для текста или tag для интерактива`,
    );
  }
  if (интерактивный && typeof definition.load !== 'function') {
    throw new Error(`блок "${definition.kind}": интерактивному блоку нужен load для отложенной загрузки`);
  }
  registry.set(definition.kind, definition as unknown as BlockDefinition);
  version += 1;
  return (props) => ({ ...props, kind: definition.kind }) as T;
}

export function lookupBlock(kind: string): BlockDefinition | undefined {
  return registry.get(kind);
}

/** Виды в порядке регистрации: по этому списку строится галерея блоков. */
export function blockKinds(): string[] {
  return [...registry.keys()];
}

export function blockDefinitions(): BlockDefinition[] {
  return [...registry.values()];
}

/**
 * Схема любого блока. Отложенная: её зовут из схем других блоков, и на момент
 * вызова реестр ещё может быть пуст.
 */
export function blocks(): s.Schema<Block> {
  return {
    check(value, path = '') {
      if (!cached || cached.at !== version) {
        const branches: Record<string, s.Schema<unknown>> = {};
        for (const [kind, definition] of registry) branches[kind] = definition.schema;
        cached = { at: version, schema: s.variant('kind', branches) as s.Schema<Block> };
      }
      return cached.schema.check(value, path);
    },
    where(predicate, message) {
      const self = this;
      return {
        check(value, path = '') {
          const r = self.check(value, path);
          if (!r.ok) return r;
          return predicate(r.value) ? r : { ok: false, issues: [{ path, message }] };
        },
        where: (p, m) => blocks().where(predicate, message).where(p, m),
      };
    },
  };
}

/**
 * Отрисовать список блоков. Единственное место, которое знает, как блок
 * попадает на страницу, — и оно тоже не знает НИ ОДНОГО вида: спрашивает реестр.
 *
 * Незнакомый вид не роняет лекцию и не исчезает молча: он превращается в
 * видимую карточку с адресом беды. Читатель видит, что здесь что-то было, а
 * автор — что именно сломалось.
 */
export function renderBlocks(list: readonly Block[], context: RenderContext, path = ''): string {
  return list
    .map((block, i) => {
      const at = `${path}[${i}]`;
      const definition = registry.get(block.kind);
      if (!definition) {
        return `<div class="guasto" role="note">Неизвестный блок <code>${escapeAttribute(block.kind)}</code> в <code>${escapeAttribute(at)}</code></div>`;
      }
      if (definition.html) return definition.html(block, context);
      /* Интерактив: элемент ставится пустым, свойства едут атрибутом, и до
         появления на экране за него не платят ни байта. */
      const props = escapeAttribute(JSON.stringify(block));
      return `<${definition.tag} class="isola" data-blocco="${escapeAttribute(block.kind)}" data-props="${props}"></${definition.tag}>`;
    })
    .join('\n');
}

const ATTR: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeAttribute = (text: string): string => text.replace(/[&<>"']/g, (c) => ATTR[c]!);

/** Только для тестов: реестр глобален, и каждый случай должен начинаться с чистого. */
export function resetRegistry(): void {
  registry.clear();
  version += 1;
  cached = undefined;
}
