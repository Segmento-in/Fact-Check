import { test, expect } from '@playwright/test';

test.describe('Look and Design Tokens', () => {
  test.describe('Desktop 1280x800, route /', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('verifies body background, color, font-family and header dimensions', async ({ page }) => {
      await page.goto('/');

      // body computed background-color is rgb(246, 249, 252) and color is rgb(13, 37, 61)
      const bodyStyles = await page.evaluate(() => {
        const style = window.getComputedStyle(document.body);
        return {
          backgroundColor: style.backgroundColor,
          color: style.color,
          fontFamily: style.fontFamily,
        };
      });

      expect(bodyStyles.backgroundColor).toBe('rgb(246, 249, 252)');
      expect(bodyStyles.color).toBe('rgb(13, 37, 61)');

      // body computed font-family contains "geist" (case-insensitive)
      expect(bodyStyles.fontFamily.toLowerCase()).toContain('geist');

      // header is 64px tall and its bottom border colour is rgb(227, 232, 238)
      const header = page.locator('header');
      await expect(header).toBeVisible();

      const headerBox = await header.boundingBox();
      expect(headerBox).not.toBeNull();
      expect(Math.round(headerBox!.height)).toBe(64);

      const headerStyles = await header.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          borderBottomColor: style.borderBottomColor,
        };
      });
      expect(headerStyles.borderBottomColor).toBe('rgb(227, 232, 238)');
    });
  });

  test.describe('Phone 360x740, routes / and /feed', () => {
    test.use({ viewport: { width: 360, height: 740 } });

    const routes = ['/', '/feed'];

    for (const route of routes) {
      test(`verifies brand text and links sit on one row inside 64px header and no sideways scroll on ${route}`, async ({ page }) => {
        await page.goto(route);

        // inside a 64px header
        const header = page.locator('header');
        await expect(header).toBeVisible();

        const headerBox = await header.boundingBox();
        expect(headerBox).not.toBeNull();
        expect(Math.round(headerBox!.height)).toBe(64);

        // brand text and both links sit on one row (vertical centres differ by 2px or less)
        const brand = page.getByText('Fact Checker');
        const checkLink = page.getByRole('link', { name: 'Check' });
        const feedLink = page.getByRole('link', { name: 'Live Feed' });

        await expect(brand).toBeVisible();
        await expect(checkLink).toBeVisible();
        await expect(feedLink).toBeVisible();

        const brandBox = await brand.boundingBox();
        const checkBox = await checkLink.boundingBox();
        const feedBox = await feedLink.boundingBox();

        expect(brandBox).not.toBeNull();
        expect(checkBox).not.toBeNull();
        expect(feedBox).not.toBeNull();

        const brandCenterY = brandBox!.y + brandBox!.height / 2;
        const checkCenterY = checkBox!.y + checkBox!.height / 2;
        const feedCenterY = feedBox!.y + feedBox!.height / 2;

        expect(Math.abs(brandCenterY - checkCenterY)).toBeLessThanOrEqual(2);
        expect(Math.abs(brandCenterY - feedCenterY)).toBeLessThanOrEqual(2);
        expect(Math.abs(checkCenterY - feedCenterY)).toBeLessThanOrEqual(2);

        // no sideways scroll: document.documentElement.scrollWidth <= window.innerWidth
        const scrollWidthFits = await page.evaluate(() => {
          return document.documentElement.scrollWidth <= window.innerWidth;
        });
        expect(scrollWidthFits).toBe(true);
      });
    }
  });
});

