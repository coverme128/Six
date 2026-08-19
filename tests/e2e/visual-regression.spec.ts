import { expect, test } from "@playwright/test";

const apiBaseURL = process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:4100/api/v1";

async function createReport(request) {
  const response = await request.post(`${apiBaseURL}/liuyao/charts`, {
    data: {
      question: "是否应该继续推进当前求职机会？",
      topic: "career",
      subtype: "job_search",
      values: [7, 8, 9, 7, 8, 6],
      calendar: { timezone: "Asia/Shanghai" },
    },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return body.id ?? body.chart?.id;
}

async function stablePage(page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}.ly-line.moving i{animation:none!important;opacity:1!important;box-shadow:none!important}nextjs-portal,[data-nextjs-toast]{display:none!important}" });
  await page.evaluate(() => document.fonts.ready);
}

test("core public surfaces keep approved visual structure", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "把一件难事，看清方向与下一步" })).toBeVisible();
  await stablePage(page);
  await expect(page.locator(".product-hero")).toHaveScreenshot("homepage-core.png", { animations: "disabled" });

  await page.goto("/content");
  await expect(page.getByRole("heading", { name: "按你的目标，找到下一步" })).toBeVisible();
  await stablePage(page);
  await expect(page.locator(".content-hub-hero")).toHaveScreenshot("learn-hub-core.png", { animations: "disabled" });

  await page.goto("/content/tutorial/why-not-repeat-liuyao-readings");
  await expect(page.getByRole("heading", { name: "为什么不建议对同一个问题反复起卦" })).toBeVisible();
  await stablePage(page);
  await expect(page.locator(".article-hero")).toHaveScreenshot("article-core.png", { animations: "disabled" });

  await page.goto("/content/glossary/useful_god");
  await expect(page.getByRole("heading", { name: "用神", exact: true })).toBeVisible();
  await stablePage(page);
  await expect(page.locator(".reference-hero")).toHaveScreenshot("glossary-core.png", { animations: "disabled" });

  const reportId = await createReport(request);
  await page.goto(`/reports/${reportId}`);
  await expect(page.locator(".ly-advanced-disclosure")).toBeVisible();
  await stablePage(page);
  await expect(page.locator(".ly-visual-system")).toHaveScreenshot("report-visual-system.png", { animations: "disabled" });
  await page.locator(".ly-advanced-disclosure > summary").click();
  await expect(page.locator('[data-visual-id="VIS-LY-014"]')).toBeVisible();
  await expect(page.locator(".ly-advanced-disclosure")).toHaveScreenshot("report-p1-visuals.png", { animations: "disabled" });
});

test("report exposes a coherent screen-reader summary and keyboard flow", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one semantic audit covers shared DOM");
  const reportId = await createReport(request);
  await page.goto(`/reports/${reportId}`);
  const section = page.locator(".ly-visual-system");
  await expect(section).toHaveAttribute("aria-describedby", "liuyao-visual-system-summary");
  await expect(page.locator("#liuyao-visual-system-summary")).toContainText("盘面按上爻到初爻阅读");
  await expect(page.locator(".ly-board-lines")).toHaveAttribute("role", "list");
  await expect(page.locator(".ly-board-line")).toHaveCount(6);
  await expect(page.locator(".ly-board-line[role=listitem]")).toHaveCount(6);
  await expect(page.locator(".ly-board-line button")).toHaveCount(0);

  const unnamedButtons = await page.getByRole("button").evaluateAll((buttons) => buttons.filter((button) => !(button.getAttribute("aria-label") || button.textContent?.trim())).length);
  expect(unnamedButtons).toBe(0);
  const duplicateIds = await page.locator("[id]").evaluateAll((elements) => {
    const ids = elements.map((element) => element.id);
    return ids.filter((id, index) => ids.indexOf(id) !== index);
  });
  expect(duplicateIds).toEqual([]);

  await page.emulateMedia({ media: "print", reducedMotion: "reduce" });
  await expect(page.locator(".app-nav")).toBeHidden();
  await expect(page.getByTestId("print-report")).toBeHidden();
  const pdf = await page.pdf({ format: "A4", printBackground: true });
  expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  expect(pdf.byteLength).toBeGreaterThan(20_000);
});

test("all 68 art-directed content visuals render with semantic alternatives", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one gallery audit covers the shared SVG files");
  await page.goto("/content-growth/visual-production-gallery.html");
  const figures = page.locator("figure");
  await expect(figures).toHaveCount(68);
  const renderFailures = await page.locator("figure img").evaluateAll((images: HTMLImageElement[]) => images.filter((image) => !image.complete || image.naturalWidth !== 1200 || image.naturalHeight !== 675 || !image.alt.trim()).map((image) => image.src));
  expect(renderFailures).toEqual([]);
  const layouts = await figures.evaluateAll((items) => [...new Set(items.map((item) => item.getAttribute("data-layout")))].sort());
  expect(layouts).toEqual(["comparison", "cycle", "flow", "matrix", "relationship", "stack", "timeline"]);
});
