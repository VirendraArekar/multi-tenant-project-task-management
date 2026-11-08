import { test, expect } from "@playwright/test";

test.describe("TeamBoard Frontend Component & Form Tests", () => {
  test("Auth Form Validation: Empty submissions trigger HTML5/client validation", async ({
    page,
  }) => {
    // 1. Check Login Form validation
    await page.goto("/login");
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitBtn = page.locator('button[type="submit"]');

    await expect(emailInput).toHaveAttribute("required", "");
    await expect(passwordInput).toHaveAttribute("required", "");

    // 2. Check Register Form validation
    await page.goto("/register");
    const nameInput = page.locator('input[placeholder*="name" i], input[id*="name" i]');
    const regEmail = page.locator('input[type="email"]');
    const regPass = page.locator('input[type="password"]');
    const regOrg = page.locator('input[placeholder*="organization" i], input[placeholder*="workspace" i]');

    await expect(nameInput).toHaveAttribute("required", "");
    await expect(regEmail).toHaveAttribute("required", "");
    await expect(regPass).toHaveAttribute("required", "");
    await expect(regOrg).toHaveAttribute("required", "");
  });

  test("Empty States & UI Shell Components Render Correctly", async ({ page }) => {
    await page.goto("/login");
    // Verify brand header and branding icon
    await expect(page.locator("body")).toContainText("TeamBoard");
    await expect(page.locator("body")).toContainText("Sign in to your account");
    await expect(page.locator("body")).toContainText("Don't have an account?");
  });
});
