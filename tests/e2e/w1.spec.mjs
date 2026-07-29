import { expect, test } from "@playwright/test";

async function clearHistory(request) {
  await request.post("/api/v1/history/clear");
}

async function createLiuyaoReport(request, question = "E2E 刷新回放是否稳定？") {
  const response = await request.post("/api/v1/liuyao/charts", {
    data: {
      question,
      topic: "career",
      subtype: "job_search",
      values: [7, 8, 7, 8, 7, 8],
      calendar: { timezone: "Asia/Shanghai" },
    },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return body.chart.id;
}

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
}

test.beforeEach(async ({ request }) => {
  await clearHistory(request);
});

test("六爻铜钱起卦进入正式报告，刷新后仍可恢复", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop flow coverage");
  await page.goto("/");
  const form = page.locator("#liuyaoForm");
  await form.getByLabel("输入方式").selectOption("coins");
  await page.getByRole("button", { name: "随机铜钱" }).click();
  await form.getByRole("button", { name: "生成报告" }).click();
  await expect(page).toHaveURL(/\/reports\/ly_/u);
  await expect(page.getByTestId("report-page")).toContainText("六爻报告");
  await page.reload();
  await expect(page.getByTestId("report-page")).toContainText("一句话结论");
});

test("六爻手工起卦和输入错误提示可用", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop flow coverage");
  await page.goto("/");
  const form = page.locator("#liuyaoForm");
  await form.locator('textarea[name="question"]').fill("");
  await form.getByRole("button", { name: "生成报告" }).click();
  await expect(page.locator("#liuyaoQuestionError")).toContainText("问题不能为空");

  await form.locator('textarea[name="question"]').fill("手工排盘是否能生成报告？");
  await form.getByLabel("输入方式").selectOption("values");
  await page.getByRole("button", { name: "示例卦" }).click();
  await form.getByRole("button", { name: "生成报告" }).click();
  await expect(page).toHaveURL(/\/reports\/ly_/u);
  await expect(page.getByRole("heading", { name: "六爻报告" })).toBeVisible();
});

test("梅花两数和时间起卦都生成统一报告页", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop flow coverage");
  await page.goto("/meihua");
  const form = page.locator("#meihuaForm");
  await form.getByRole("button", { name: "生成报告" }).click();
  await expect(page).toHaveURL(/\/reports\/mh_/u);
  await expect(page.getByRole("heading", { name: "梅花报告" })).toBeVisible();

  await page.goto("/meihua");
  await form.getByLabel("起卦方式").selectOption("MEIHUA_TIME_LUNAR_BRANCH_V1");
  await form.locator('textarea[name="question"]').fill("时间起卦是否能生成报告？");
  await form.getByRole("button", { name: "生成报告" }).click();
  await expect(page).toHaveURL(/\/reports\/mh_/u);
  await expect(page.locator("#reportView summary")).toContainText("专业依据");
});

test("历史列表可回放报告，404 使用友好错误", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop flow coverage");
  const id = await createLiuyaoReport(request, "历史回放是否正常？");
  await page.goto("/history");
  const item = page.getByTestId("history-item").filter({ hasText: "历史回放是否正常" });
  await expect(item).toContainText("历史回放是否正常");
  await item.getByRole("button", { name: "打开报告" }).click();
  await expect(page).toHaveURL(new RegExp(`/reports/${id}$`, "u"));
  await expect(page.getByRole("heading", { name: "六爻报告" })).toBeVisible();

  await page.goto("/reports/not-real");
  await expect(page.getByText("未找到该报告")).toBeVisible();
});

test("Blog、知识详情、卦象详情与设置页可访问", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop flow coverage");
  await page.goto("/blog");
  await page.getByRole("button", { name: "阅读" }).first().click();
  await expect(page).toHaveURL(/\/blog\/[^/]+$/u);
  await expect(page.locator("#viewTitle")).toHaveText("文章详情");

  await page.goto("/knowledge");
  await page.getByRole("button", { name: "查看" }).first().click();
  await expect(page).toHaveURL(/\/knowledge\/[^/]+$/u);
  await expect(page.getByText("知识详情")).toBeVisible();

  await page.goto("/hexagrams/qian");
  await expect(page.getByText("六十四卦详情")).toBeVisible();

  await page.goto("/app/settings");
  await page.getByLabel("默认时区").fill("Asia/Tokyo");
  await page.getByRole("button", { name: "保存设置" }).click();
  await expect(page.locator("#status")).toContainText("settings saved");
});

test("导出 JSON 与清空历史可用", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop flow coverage");
  await createLiuyaoReport(request, "导出清空流程是否正常？");
  const exported = await request.get("/api/v1/export");
  expect(exported.ok()).toBeTruthy();
  const body = await exported.json();
  expect(body.reports.length).toBeGreaterThan(0);

  await page.goto("/history");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "清空历史" }).click();
  await expect(page.getByText("暂无历史记录")).toBeVisible();
});

test("移动视口可打开工具、历史和正式报告且无横向溢出", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "mobile viewport coverage");
  const id = await createLiuyaoReport(request, `移动视口 ${testInfo.project.name} 报告`);
  for (const path of ["/", "/meihua", "/history", "/blog", "/knowledge", "/app/settings", `/reports/${id}`]) {
    await page.goto(path);
    await expect(page.locator("#viewTitle")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
  await expect(page.getByTestId("report-page")).toContainText("六爻报告");
});
