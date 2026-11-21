import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Pages E2E Flow and Behavior', () => {
  test('Journey: / submit text -> land on sample-all-verdicts -> switch claims -> submit with author switch -> sample-i-wrote-this', async ({
    page,
  }) => {
    // 1. Visit /
    await page.goto('/');
    const textarea = page.locator('textarea#check-input');
    await expect(textarea).toBeVisible();

    await textarea.fill('This is a checkable assertion that exceeds twenty characters in length.');
    await page.getByRole('button', { name: 'Check this' }).click();

    // 2. Land on /report/sample-all-verdicts
    await expect(page).toHaveURL(/\/report\/sample-all-verdicts$/);
    await expect(page.locator('h1')).toContainText('Harbor City council votes on transit levy');

    // 3. See four Verdict tiles
    const countTiles = page.locator('[data-section="count-tiles"]');
    await expect(countTiles).toBeVisible();
    const verdictChips = countTiles.locator('[data-verdict]');
    expect(await verdictChips.count()).toBe(4);

    // 4. Click the second Claim and see centre change
    const claimButtons = page.locator('[data-section="claim-list"] button');
    await expect(claimButtons).toHaveCount(4);

    const selectedClaimSection = page.locator('[data-section="selected-claim"]');
    await expect(selectedClaimSection).toContainText('Harbor City council approved');

    await claimButtons.nth(1).click();
    await expect(selectedClaimSection).toContainText('The transit measure immediately triples property tax collections');

    // 5. With the switch on, land on sample-i-wrote-this and see the Fix List
    await page.goto('/');
    await page.locator('textarea#check-input').fill('I wrote this post about the historic bridge in my local neighborhood.');
    const switchEl = page.getByRole('switch');
    await switchEl.click();
    await expect(switchEl).toHaveAttribute('aria-checked', 'true');

    await page.getByRole('button', { name: 'Check this' }).click();
    await expect(page).toHaveURL(/\/report\/sample-i-wrote-this$/);
    await expect(page.locator('[data-section="side-panel"]')).toContainText('Fix List');
  });

  test('Validation: empty click shows the message and stays on /', async ({ page }) => {
    await page.goto('/');
    const textarea = page.locator('textarea#check-input');
    await expect(textarea).toBeVisible();

    await expect(async () => {
      await page.getByRole('button', { name: 'Check this' }).click();
      await expect(page.locator('#check-error')).toHaveText('Paste some text or a link first.');
    }).toPass({ timeout: 5000 });

    expect(page.url()).toMatch(/\/$/);
  });

  test('/feed: 8 cards, click the third, land on its report, click Refresh Feed', async ({ page }) => {
    await page.goto('/feed');
    const articles = page.locator('article');
    await expect(articles).toHaveCount(8);

    // Click the third card (headline link)
    const thirdCardLink = articles.nth(2).locator('a');
    await expect(thirdCardLink).toBeVisible();
    await thirdCardLink.click();

    await expect(page).toHaveURL(/\/report\/sample-all-verdicts$/);

    // Go back and test Refresh Feed
    await page.goto('/feed');
    const refreshBtn = page.getByRole('button', { name: /Refresh Feed/i });
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();
    await expect(page.locator('article')).toHaveCount(8);
  });

  test('Keyboard only submission journey', async ({ page }) => {
    await page.goto('/');

    // Focus order:
    // Skip link -> Check -> Live Feed -> ContentKindSelector (Claim or text radio) -> textarea -> Switch -> Button
    await page.keyboard.press('Tab'); // skip link
    await page.keyboard.press('Tab'); // Check
    await page.keyboard.press('Tab'); // Live Feed
    await page.keyboard.press('Tab'); // ContentKindSelector radio group

    const radioFocused = page.locator(':focus');
    await expect(radioFocused).toHaveAttribute('name', 'content-kind');
    await expect(radioFocused).toHaveAttribute('value', 'claim_or_text');

    await page.keyboard.press('Tab'); // textarea
    const focused = page.locator(':focus');
    await expect(focused).toHaveAttribute('id', 'check-input');

    await page.keyboard.type('Submitting purely using the keyboard navigation on the page.');

    await page.keyboard.press('Tab'); // Switch
    const switchFocus = page.locator(':focus');
    await expect(switchFocus).toHaveAttribute('role', 'switch');
    await page.keyboard.press('Space'); // toggle switch
    await expect(switchFocus).toHaveAttribute('aria-checked', 'true');

    await page.keyboard.press('Tab'); // Button "Check this"
    const buttonFocus = page.locator(':focus');
    await expect(buttonFocus).toHaveText('Check this');
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/report\/sample-i-wrote-this$/);
  });

  test('Arrow keys inside the kind group change the kind and keyboard journey with non-default reaches a report', async ({
    page,
  }) => {
    await page.goto('/');

    await page.keyboard.press('Tab'); // skip link
    await page.keyboard.press('Tab'); // Check
    await page.keyboard.press('Tab'); // Live Feed
    await page.keyboard.press('Tab'); // ContentKindSelector (Claim or text)

    // Press ArrowRight to move to Article link
    await page.keyboard.press('ArrowRight');
    const focusedRadio = page.locator(':focus');
    await expect(focusedRadio).toHaveAttribute('value', 'article_link');

    // Press Tab to enter textarea
    await page.keyboard.press('Tab');
    const textarea = page.locator(':focus');
    await expect(textarea).toHaveAttribute('id', 'check-input');

    // Enter a valid URL
    await page.keyboard.type('https://apnews.com/article/harbor-levy-vote-approved');

    // Tab past author switch to button
    await page.keyboard.press('Tab'); // switch
    await page.keyboard.press('Tab'); // submit button
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/report\/sample-all-verdicts$/);
  });

  test('Headline too long shows its message and stays on /', async ({ page }) => {
    await page.goto('/');

    // Select Headline via its visible label
    await page.locator('label[for="content-kind-headline"]').click();

    const textarea = page.locator('textarea#check-input');
    await expect(textarea).toHaveAttribute('placeholder', 'Paste the headline');

    const longHeadline = 'H'.repeat(301);
    await textarea.fill(longHeadline);
    await page.getByRole('button', { name: 'Check this' }).click();

    const alert = page.locator('#check-error');
    await expect(alert).toHaveText(
      'That is too long for a headline. Choose Claim or text for longer pieces.'
    );
    expect(page.url()).toMatch(/\/$/);
  });

  test('Phone 360x740 on all three routes: no sideways scroll with the selector, and dashboard sections stack in order', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });

    const routes = ['/', '/feed', '/report/sample-all-verdicts'];
    for (const route of routes) {
      await page.goto(route);
      const scrollFits = await page.evaluate(() => {
        return document.documentElement.scrollWidth <= window.innerWidth;
      });
      expect(scrollFits, `Sideways scroll detected on ${route}`).toBe(true);
    }

    // On report dashboard, verify vertical stacking order of the 4 sections
    await page.goto('/report/sample-all-verdicts');
    const countTiles = page.locator('[data-section="count-tiles"]');
    const claimList = page.locator('[data-section="claim-list"]');
    const selectedClaim = page.locator('[data-section="selected-claim"]');
    const sidePanel = page.locator('[data-section="side-panel"]');

    const bCount = await countTiles.boundingBox();
    const bClaims = await claimList.boundingBox();
    const bSelected = await selectedClaim.boundingBox();
    const bSide = await sidePanel.boundingBox();

    expect(bCount).not.toBeNull();
    expect(bClaims).not.toBeNull();
    expect(bSelected).not.toBeNull();
    expect(bSide).not.toBeNull();

    expect(bCount!.y).toBeLessThan(bClaims!.y);
    expect(bClaims!.y).toBeLessThan(bSelected!.y);
    expect(bSelected!.y).toBeLessThan(bSide!.y);
  });

  test('Accessibility: axe checks on /, /report/sample-all-verdicts, /feed at 1280 and 360 widths', async ({
    page,
  }) => {
    const viewports = [
      { width: 1280, height: 800 },
      { width: 360, height: 740 },
    ];
    const routes = ['/', '/report/sample-all-verdicts', '/feed'];

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      for (const route of routes) {
        await page.goto(route);
        await page.waitForLoadState('networkidle');

        const axeResults = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();

        expect(
          axeResults.violations,
          `Accessibility violations found on ${route} at ${vp.width}x${vp.height}: ${JSON.stringify(axeResults.violations, null, 2)}`
        ).toEqual([]);
      }
    }
  });

  test('Accessibility: axe checks on / with Social post selected and in error state at 1280 and 360', async ({
    page,
  }) => {
    const viewports = [
      { width: 1280, height: 800 },
      { width: 360, height: 740 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await page.goto('/');

      // 1. Social post selected via its visible label
      await page.locator('label[for="content-kind-social_post"]').click();
      let axeResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(axeResults.violations).toEqual([]);

      // 2. Error state (empty submit)
      await page.getByRole('button', { name: 'Check this' }).click();
      await expect(page.locator('#check-error')).toBeVisible();

      axeResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(axeResults.violations).toEqual([]);
    }
  });

  test('/feed and /report/sample-verified have no .mesh element', async ({ page }) => {
    await page.goto('/feed');
    expect(await page.locator('.mesh').count()).toBe(0);

    await page.goto('/report/sample-verified');
    expect(await page.locator('.mesh').count()).toBe(0);

    await page.goto('/');
    expect(await page.locator('.mesh').count()).toBeGreaterThan(0);
  });
});
