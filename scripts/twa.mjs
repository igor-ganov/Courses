/**
 * TWA — связка сайта с приложением Android.
 *
 * Trusted Web Activity показывает этот же сайт как приложение, без адресной
 * строки. Условие ровно одно: сайт должен подтвердить, что названное
 * приложение — своё. Подтверждение это и есть `/.well-known/assetlinks.json`
 * с именем пакета и отпечатком ключа, которым приложение подписано.
 *
 * Отпечаток нельзя ни придумать, ни зашить в репозиторий: он берётся из
 * ключа подписи, ключ лежит у того, кто выпускает приложение, и любой другой
 * отпечаток означает молча неработающую связку — адресная строка просто
 * останется на месте, и никто не поймёт почему. Поэтому файл пишется только
 * тогда, когда оба значения переданы окружением, и его отсутствие — не
 * ошибка сборки, а «приложение ещё не выпускали».
 *
 *   TWA_PACKAGE=ru.example.quaderno \
 *   TWA_FINGERPRINT=AA:BB:… npm run build
 *
 * Отпечаток — SHA-256 сертификата подписи, тот самый, что печатает
 * `keytool -list -v -keystore …` или страница «Целостность приложения» в
 * Play Console. Их может быть несколько (свой ключ и ключ Play App Signing) —
 * тогда перечислите через запятую, и в файл попадут все.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIST = process.argv[2] ?? 'dist';

const пакет = process.env['TWA_PACKAGE']?.trim();
const отпечатки = (process.env['TWA_FINGERPRINT'] ?? '')
  .split(',')
  .map((f) => f.trim().toUpperCase())
  .filter(Boolean);

if (!пакет || отпечатки.length === 0) {
  console.log('twa: пакет и отпечаток не переданы — связку с приложением не пишем');
  process.exit(0);
}

const ОТПЕЧАТОК = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const кривые = отпечатки.filter((f) => !ОТПЕЧАТОК.test(f));
if (кривые.length > 0) {
  /* Падаем, а не пишем как есть: неверный отпечаток выглядит точно так же,
     как верный, и обнаруживается только на устройстве. */
  console.error(`twa: не похоже на SHA-256 сертификата: ${кривые.join(', ')}`);
  process.exit(1);
}

const связка = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: пакет,
      sha256_cert_fingerprints: отпечатки,
    },
  },
];

await mkdir(join(DIST, '.well-known'), { recursive: true });
await writeFile(join(DIST, '.well-known', 'assetlinks.json'), JSON.stringify(связка, null, 2), 'utf8');

console.log(`twa: связка с ${пакет} записана, отпечатков ${отпечатки.length}`);
