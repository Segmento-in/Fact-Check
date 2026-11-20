import { test, expect } from '@playwright/test';

test.describe('Navigation and Accessibility', () => {
  test('open /: navbar visible with both links and Check has aria-current="page"', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    const checkLink = page.getByRole('link', { name: 'Check' });
    const feedLink = page.getByRole('link', { name: 'Live Feed' });

    await expect(checkLink).toBeVisible();
    await expect(feedLink).toBeVisible();
    await expect(checkLink).toHaveAttribute('aria-current', 'page');
    await expect(feedLink).not.toHaveAttribute('aria-current');
  });

  test('click Live Feed: URL is /feed and Live Feed has aria-current="page"', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Live Feed' }).click();

    await expect(page).toHaveURL(/\/feed$/);
    const feedLink = page.getByRole('link', { name: 'Live Feed' });
    const checkLink = page.getByRole('link', { name: 'Check' });

    await expect(feedLink).toHaveAttribute('aria-current', 'page');
    await expect(checkLink).not.toHaveAttribute('aria-current');
  });

  test('tab once from page load: focus lands on "Skip to content"', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');

    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toHaveText('Skip to content');
    await expect(focusedElement).toHaveAttribute('href', '#main');
  });
});

