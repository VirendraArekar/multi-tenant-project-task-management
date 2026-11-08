import { test, expect } from "@playwright/test";

test.describe("TeamBoard SaaS End-to-End Workflow", () => {
  const timestamp = Date.now();
  const testEmail = `sarah_${timestamp}@cyberdyne.io`;
  const testPassword = "Password123!";
  const testOrgName = `Cyberdyne Systems ${timestamp}`;
  const testProjectName = `AI Core Platform ${timestamp}`;

  test("Complete user journey: Register -> Create Project -> Add Task -> Move Card -> Invite Teammate", async ({
    page,
  }) => {
    // 1. Visit landing page
    await page.goto("/");
    await expect(page).toHaveTitle(/TeamBoard/i);

    // 2. Register new user and organization
    await page.click("text=Get Started");
    await expect(page).toHaveURL(/.*register/);

    await page.fill('input[type="text"][placeholder*="name" i], input[id*="name" i], input[name*="name" i]', "Sarah Connor");
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.fill('input[placeholder*="workspace" i], input[placeholder*="organization" i], input[id*="org" i]', testOrgName);

    await page.click('button[type="submit"]:has-text("Create Account")');

    // 3. Verify redirected to dashboard
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 15000 });
    await expect(page.locator("h1")).toContainText(/Dashboard/i);
    await expect(page.locator("body")).toContainText(testOrgName);

    // 4. Navigate to Projects page
    await page.click('a[href="/projects"]');
    await expect(page).toHaveURL(/.*projects/);

    // 5. Create a new project
    await page.click('button:has-text("New Project"), button:has-text("Create Project")');
    await page.fill('input[placeholder*="project name" i], input[id*="name" i]', testProjectName);
    await page.fill('textarea[placeholder*="description" i]', "Autonomous reasoning engine and distributed queue");
    await page.click('button[type="submit"]:has-text("Create Project")');

    // Verify project appears in list
    await expect(page.locator("body")).toContainText(testProjectName);

    // 6. Navigate to Project Kanban Board
    await page.click(`text=${testProjectName}`);
    await expect(page).toHaveURL(/.*projects\/.*\/board/);
    await expect(page.locator("h1")).toContainText(testProjectName);

    // Verify Kanban columns (To Do, In Progress, In Review, Done)
    await expect(page.locator("body")).toContainText(/To Do/i);
    await expect(page.locator("body")).toContainText(/In Progress/i);
    await expect(page.locator("body")).toContainText(/In Review/i);
    await expect(page.locator("body")).toContainText(/Done/i);

    // 7. Create a new task
    await page.click('button:has-text("Add Task"), button:has-text("New Task")');
    await page.fill('input[placeholder*="task title" i], input[id*="title" i]', "Neural Net Calibration");
    await page.fill('textarea[placeholder*="description" i]', "Optimize weights across distributed nodes");
    await page.selectOption('select:has-text("Priority"), select[name*="priority" i]', "HIGH");
    await page.click('button[type="submit"]:has-text("Create Task")');

    // Verify card is rendered on board
    await expect(page.locator("body")).toContainText("Neural Net Calibration");

    // 8. Open Task Detail Drawer
    await page.click("text=Neural Net Calibration");
    await expect(page.locator("body")).toContainText("Task Details");
    await expect(page.locator("body")).toContainText("Activity & Comments");

    // Add comment
    await page.fill('textarea[placeholder*="comment" i]', "Verified precision threshold above 99.8%");
    await page.click('button:has-text("Post Comment")');
    await expect(page.locator("body")).toContainText("Verified precision threshold above 99.8%");

    // Close drawer
    await page.click('button[aria-label="Close"], button:has-text("Close")');

    // 9. Navigate to Members page & Create Invite
    await page.click('a[href="/members"]');
    await expect(page).toHaveURL(/.*members/);

    await page.click('button:has-text("Invite Teammate")');
    await page.fill('input[type="email"]', `teammate_${timestamp}@cyberdyne.io`);
    await page.selectOption('select:has-text("Role"), select[name*="role" i]', "ADMIN");
    await page.click('button[type="submit"]:has-text("Generate Invite Link"), button:has-text("Create Invite")');

    // Verify invite link created and rendered
    await expect(page.locator("body")).toContainText(/invite\/accept/i);
    await expect(page.locator("body")).toContainText(/Copy Link/i);

    // 10. Navigate to Activity page
    await page.click('a[href="/activity"]');
    await expect(page).toHaveURL(/.*activity/);
    await expect(page.locator("body")).toContainText(/Event Stream/i);
  });
});
