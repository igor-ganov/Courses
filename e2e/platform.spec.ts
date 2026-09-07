import { expect, test, type Page } from '@playwright/test';

/**
 * End-to-end coverage of the journeys that matter:
 *
 *  - a learner can get from the front page into a lecture and back;
 *  - interacting with a simulation actually earns progress;
 *  - answering the quiz records a result that survives a reload;
 *  - the whole thing keeps working with the network switched off, which is the
 *    entire point of the project.
 */

const firstLevel = '#/course/cybernetics-101/whatis/1';

async function gotoLevel(page: Page, hash = firstLevel) {
  await page.goto(`./${hash}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

test.describe('навигация', () => {
  test('главная показывает курс и ведёт в первую лекцию', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('heading', { name: /Кибернетика как набор инструментов/ })).toBeVisible();

    await page.getByRole('link', { name: /Начать курс|Продолжить/ }).first().click();
    await expect(page).toHaveURL(/#\/course\/cybernetics-101\//);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('карта курса показывает все модули и уровни каждой темы', async ({ page }) => {
    await page.goto('./#/course/cybernetics-101');
    await expect(page.getByRole('heading', { name: 'Основания' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Разнообразие и информация' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Обратная связь/ }).first()).toBeVisible();
  });

  test('неизвестный адрес показывает страницу-заглушку, а не пустой экран', async ({ page }) => {
    await page.goto('./#/course/cybernetics-101/nonexistent/1');
    await expect(page.getByRole('heading', { name: 'Такой страницы нет' })).toBeVisible();
  });

  test('галерея компонентов перечисляет зарегистрированные блоки', async ({ page }) => {
    await page.goto('./#/blocks');
    await expect(page.getByRole('heading', { name: 'Библиотека компонентов' })).toBeVisible();
    await expect(page.getByText('sim.control-loop')).toBeVisible();
    await expect(page.getByText('three.phase-space')).toBeVisible();
  });
});

test.describe('лекция', () => {
  test('отрисовывает материал без ошибок авторской вёрстки', async ({ page }) => {
    await gotoLevel(page);
    // A block that fails validation renders as role="alert" — there must be none.
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByText('Чему учит этот уровень')).toBeVisible();
  });

  test('тактильная схема раскрывает пояснение при нажатии на узел', async ({ page }) => {
    await gotoLevel(page);
    const diagram = page.getByRole('group', { name: /Схема контура управления/ });
    await expect(diagram).toBeVisible();
    await diagram.getByRole('button', { name: /Компаратор/ }).click();
    await expect(page.getByText(/Вычитает измеренное из желаемого/)).toBeVisible();
  });

  test('симуляция контура пересчитывается при движении ползунка', async ({ page }) => {
    await gotoLevel(page, '#/course/cybernetics-101/feedback/1');
    const lab = page.getByRole('region', { name: /Разомкнуть и замкнуть/ });
    await expect(lab).toBeVisible();

    const readout = lab.locator('.readout', { hasText: 'Статическая ошибка' }).locator('.readout__value');
    const before = await readout.textContent();

    const gain = lab.getByLabel('Усиление P');
    await gain.fill('9');
    await expect(readout).not.toHaveText(before ?? '');
  });
});

test.describe('прогресс', () => {
  test('взаимодействие с блоком начисляет опыт и сохраняется после перезагрузки', async ({ page }) => {
    await gotoLevel(page);

    const xpBefore = await readXp(page);
    const diagram = page.getByRole('group', { name: /Схема контура управления/ });
    for (const name of ['Уставка', 'Компаратор', 'Регулятор', 'Исполнитель', 'Объект', 'Датчик', 'Возмущение']) {
      await diagram.getByRole('button', { name: new RegExp(`^${name}`) }).click();
    }

    await expect.poll(() => readXp(page)).toBeGreaterThan(xpBefore);
    const earned = await readXp(page);

    await page.reload();
    expect(await readXp(page)).toBe(earned);
  });

  test('проверка уровня оценивается и показывает разбор', async ({ page }) => {
    await gotoLevel(page);

    const quiz = page.getByRole('region', { name: 'Проверка понимания' }).first();
    await quiz.scrollIntoViewIfNeeded();
    await quiz.getByRole('radio').first().click();
    await quiz.getByRole('button', { name: 'Проверить' }).click();

    await expect(quiz.getByText(/Зачтено|Пока не зачтено/)).toBeVisible();
    await expect(quiz.getByRole('button', { name: 'Пройти заново' })).toBeVisible();
  });

  test('страница прогресса показывает ранг, награды и позволяет сбросить данные', async ({ page }) => {
    await page.goto('./#/progress');
    await expect(page.getByRole('heading', { name: /Наблюдатель|Оператор|Регулятор/ })).toBeVisible();
    await expect(page.getByText('Первый контур')).toBeVisible();

    page.on('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Сбросить прогресс' }).click();
    await expect(page.getByText('Прогресс сброшен.')).toBeVisible();
  });
});

test.describe('офлайн-первая работа', () => {
  test('приложение полностью работает без сети', async ({ page, context }) => {
    // Warm the cache the way a real user would: open the app once online.
    await page.goto('./');
    await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, undefined, { timeout: 20_000 });
    await gotoLevel(page, '#/course/cybernetics-101/feedback/1');

    await context.setOffline(true);
    await page.reload();

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('region', { name: /Разомкнуть и замкнуть/ })).toBeVisible();

    // And navigation between lectures still works with no network at all.
    await page.goto('./#/course/cybernetics-101/variety/1');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Разнообразие');
    await expect(page.getByRole('region', { name: /Убедитесь сами/ })).toBeVisible();

    await context.setOffline(false);
  });

  test('манифест и иконки отдаются приложению', async ({ page }) => {
    const manifest = await page.request.get('./manifest.webmanifest');
    expect(manifest.ok()).toBeTruthy();
    const body = await manifest.json();
    expect(body.name).toContain('Cybernetica');
    expect(body.display).toBe('standalone');
    expect(body.icons.length).toBeGreaterThanOrEqual(3);

    const icon = await page.request.get('./icons/icon-512.png');
    expect(icon.ok()).toBeTruthy();
  });
});

test.describe('доступность и мобильный вид', () => {
  test('страница не уезжает по горизонтали на узком экране', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoLevel(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('по лекции можно двигаться с клавиатуры', async ({ page }) => {
    await gotoLevel(page);
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.tagName ?? '');
    expect(['A', 'BUTTON', 'INPUT', 'G', 'SUMMARY', 'SELECT']).toContain(focused);
  });
});

/** Read the XP number the top bar exposes through its accessible label. */
async function readXp(page: Page): Promise<number> {
  const label = await page.getByRole('link', { name: /Прогресс:/ }).getAttribute('aria-label');
  const match = /(\d+)\s+опыта/.exec(label ?? '');
  return match ? Number(match[1]) : 0;
}
