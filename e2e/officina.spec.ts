/**
 * МАСТЕРСКАЯ — проверка того, что читатель может решить уровень руками.
 *
 * Модель мастерской проверена своими тестами: там закреплено, что начальный
 * манифест задачу не решает, а задуманное решение решает. Но между моделью и
 * читателем стоит редактор, и его проверить может только браузер: правка
 * должна дойти до разбора, разбор — до кластера, кластер — до итога.
 *
 * Ровно здесь и ломается обычно: поле правится, а картинка не меняется.
 */
import { expect, test } from '@playwright/test';

test('правка манифеста доходит до кластера и решает уровень', async ({ page }) => {
  await page.goto('kubernetes/dichiarativo/1/');
  const прибор = page.locator('cy-officina').first();
  await прибор.scrollIntoViewIfNeeded();

  const поле = прибор.locator('textarea');
  await expect(поле).toBeVisible({ timeout: 15_000 });

  /* До правки уровень не взят, и итог объясняет, чего не хватает. */
  const итог = прибор.locator('.esito');
  await expect(итог).toContainText('replicas', { timeout: 10_000 });

  const было = await поле.inputValue();
  expect(было).toContain('replicas: 1');
  await поле.fill(было.replace('replicas: 1', 'replicas: 3'));

  /* После правки — три пода на узлах и взятый уровень. */
  await expect(итог).toContainText('Три экземпляра работают', { timeout: 10_000 });
  await expect(прибор.locator('.nodo .pod')).toHaveCount(3);
});

test('незнакомое поле названо с номером строки и близким именем', async ({ page }) => {
  await page.goto('kubernetes/dichiarativo/1/');
  const прибор = page.locator('cy-officina').first();
  await прибор.scrollIntoViewIfNeeded();
  const поле = прибор.locator('textarea');
  await expect(поле).toBeVisible({ timeout: 15_000 });

  await поле.fill((await поле.inputValue()).replace('replicas: 1', 'replica: 1'));
  const беды = прибор.locator('.guasti');
  await expect(беды).toContainText('replicas', { timeout: 10_000 });
  await expect(беды).toContainText('строка');
});

test('уровни переключаются и правки в них не путаются', async ({ page }) => {
  await page.goto('kubernetes/dichiarativo/1/');
  const прибор = page.locator('cy-officina').first();
  await прибор.scrollIntoViewIfNeeded();
  const поле = прибор.locator('textarea');
  await expect(поле).toBeVisible({ timeout: 15_000 });

  await поле.fill((await поле.inputValue()).replace('replicas: 1', 'replicas: 3'));
  await expect(прибор.locator('.esito')).toContainText('Три экземпляра работают', { timeout: 10_000 });

  /* Второй уровень — свой манифест со своей опечаткой. */
  await прибор.locator('.livello').nth(1).click();
  await expect(поле).toHaveValue(/replica: 3/, { timeout: 10_000 });

  /* И обратно: правка первого уровня на месте. */
  await прибор.locator('.livello').nth(0).click();
  await expect(поле).toHaveValue(/replicas: 3/);
});
