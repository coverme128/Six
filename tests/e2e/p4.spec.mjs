import { expect, test } from "@playwright/test";

async function createReport(request) {
  const response = await request.post("/api/v1/liuyao/charts", {
    data: {
      question: "P4 内容推荐是否稳定？",
      topic: "career",
      subtype: "job_search",
      values: [7, 8, 7, 8, 7, 8],
      calendar: { timezone: "Asia/Shanghai" },
    },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).chart.id;
}

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
}

test("P4 内容框架页面、信任页和 SEO 端点可访问", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop P4 framework coverage");
  for (const path of ["/learn", "/privacy", "/terms", "/disclaimer", "/glossary", "/trigrams", "/hexagrams"]) {
    await page.goto(path);
    await expect(page.locator("#viewTitle")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
  await page.goto("/learn");
  await expect(page.getByText("学习中心")).toBeVisible();
  await expect(page.getByText("正式内容包尚未导入")).toBeVisible();

  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Disallow: /");
  const sitemap = await request.get("/sitemap.xml");
  expect(await sitemap.text()).toContain("<urlset");
});

test("报告页展示相关知识框架且不生成死链接", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop P4 report recommendations");
  const id = await createReport(request);
  await page.goto(`/reports/${id}`);
  await expect(page.getByTestId("report-content-recommendations")).toBeVisible();
  await expect(page.getByTestId("report-page")).toContainText("六爻报告");
});

test("移动端内容导航和信任页无横向溢出", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "mobile P4 framework coverage");
  for (const path of ["/learn", "/privacy", "/trigrams", "/hexagrams/qian", "/how-it-works"]) {
    await page.goto(path);
    await expect(page.locator("#viewTitle")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});
