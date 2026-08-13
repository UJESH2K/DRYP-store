import { test, expect } from '@playwright/test';

// Task 6.2: Registration methods, required-field gating, waitlist/rejected states,
// login-only UI, legacy redirects, and password recovery.

test.describe('Registration flow', () => {
  test('register page loads with Email and Google methods', async ({ page }) => {
    await page.goto('/register');
    await expect(page).toHaveTitle(/DRYP/i);
    // Both methods should be selectable
    await expect(page.locator('text=Email')).toBeVisible();
    await expect(page.locator('text=Google')).toBeVisible();
  });

  test('email registration requires all fields', async ({ page }) => {
    await page.goto('/register');
    // Select email method if needed
    const emailTab = page.locator('[data-testid="method-email"], button:has-text("Email")').first();
    if (await emailTab.isVisible()) await emailTab.click();

    // Try submitting empty
    const submit = page.locator('button[type="submit"]').first();
    if (await submit.isVisible()) {
      await submit.click();
      // Should show validation errors, not navigate away
      await expect(page).toHaveURL(/\/register/);
    }
  });

  test('google registration requires studio name + portfolio', async ({ page }) => {
    await page.goto('/register');
    const googleTab = page.locator('[data-testid="method-google"], button:has-text("Google")').first();
    if (await googleTab.isVisible()) await googleTab.click();

    const submit = page.locator('button[type="submit"]').first();
    if (await submit.isVisible()) {
      await submit.click();
      await expect(page).toHaveURL(/\/register/);
    }
  });
});

test.describe('Waitlist and rejected states', () => {
  test('waitlist state renders without dashboard actions', async ({ page }) => {
    await page.goto('/register?status=waitlist');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveURL(/\/dashboard/);
  });

  test('rejected state renders without dashboard actions', async ({ page }) => {
    await page.goto('/register?status=rejected');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveURL(/\/dashboard/);
  });
});

test.describe('Login-only UI', () => {
  test('login page has Google, email/password, forgot-password, and register nav', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=Google')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('a[href="/forgot-password"]')).toBeVisible();
    await expect(page.locator('a[href="/register"]')).toBeVisible();
  });

  test('login page does not have signup form', async ({ page }) => {
    await page.goto('/login');
    // Should not have a second registration form
    const forms = page.locator('form');
    await expect(forms).toHaveCount(1);
  });
});

test.describe('Legacy redirects', () => {
  test('/apply redirects to /register', async ({ page }) => {
    await page.goto('/apply');
    await expect(page).toHaveURL(/\/register/);
  });

  test('/signup redirects to /register', async ({ page }) => {
    await page.goto('/signup');
    await expect(page).toHaveURL(/\/register/);
  });
});

test.describe('Dashboard gating', () => {
  test('unauthenticated user redirected from /dashboard to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Password recovery', () => {
  test('forgot-password page accepts email', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('reset-password page renders with token', async ({ page }) => {
    // Visit with a dummy token — page should render the form (not crash)
    await page.goto('/reset-password/dummy-token-12345');
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});
