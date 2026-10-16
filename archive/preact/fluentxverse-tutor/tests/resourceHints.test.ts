import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

for (const app of ['tutor', 'student']) {
  test(`${app}: shared HTML does not preload route-specific assets`, async () => {
    const html = readFileSync(new URL(`../../fluentxverse-${app}/index.html`, import.meta.url), 'utf8');
    const links: { rel: string | null; href: string | null }[] = [];
    await new HTMLRewriter().on('link', {
      element(element) {
        links.push({ rel: element.getAttribute('rel'), href: element.getAttribute('href') });
      },
    }).transform(new Response(html)).text();

    expect(links.filter(link => link.rel === 'preload')).toEqual([]);
    for (const href of ['/assets/css/bootstrap.min.css', '/assets/css/style.css', '/assets/css/flaticon.css']) {
      expect(links.some(link => link.rel === 'stylesheet' && link.href === href)).toBe(true);
    }
    for (const link of links.filter(link => link.rel === 'stylesheet' && link.href?.startsWith('/assets/'))) {
      const asset = new URL(`../../fluentxverse-${app}/public${link.href}`, import.meta.url);
      expect(await Bun.file(asset).exists()).toBe(true);
    }
  });
}
