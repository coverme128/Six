import { expect, test } from "@playwright/test";

async function clearHistory(request) {
  await request.post("/api/v1/history/clear");
}

async function createLiuyaoReport(request, question = "P2 AI 页面是否稳定？") {
  const response = await request.post("/api/v1/liuyao/charts", {
    data: {
      question,
      topic: "career",
      subtype: "job_search",
      values: [7, 8, 9, 7, 8, 6],
      calendar: { timezone: "Asia/Shanghai" },
    },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return body.chart.id;
}

async function useAIMock(page, mode) {
  await page.addInitScript((mockMode) => localStorage.setItem("six_ai_mock", mockMode), mode);
}

test.beforeEach(async ({ request }) => {
  await clearHistory(request);
});

test("AI 成功生成后刷新恢复已保存报告", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop P2 coverage");
  await useAIMock(page, "success");
  const id = await createLiuyaoReport(request, "AI 成功生成后能否刷新恢复？");
  await page.goto(`/reports/${id}`);
  await expect(page.getByTestId("ai-report-card")).toContainText("AI 智能解读");
  await expect(page.getByTestId("ai-report-card")).toContainText("概要");
  await expect(page.getByTestId("ai-report-card")).toContainText("mock");

  await page.reload();
  await expect(page.getByTestId("ai-report-card")).toContainText("AI 智能解读");
  await expect(page.getByTestId("ai-report-card")).toContainText("概要");
});

test("AI 加载状态可见", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop P2 coverage");
  await useAIMock(page, "slow_success");
  const id = await createLiuyaoReport(request, "AI 加载态是否可见？");
  await page.goto(`/reports/${id}`);
  await expect(page.getByText("正在生成智能解读")).toBeVisible();
  await expect(page.getByTestId("ai-report-card")).toContainText("概要");
});

test("AI 失败后显示确定性降级报告", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop P2 coverage");
  await useAIMock(page, "throw");
  const id = await createLiuyaoReport(request, "AI 失败是否能降级？");
  await page.goto(`/reports/${id}`);
  await expect(page.getByTestId("ai-report-card")).toContainText("智能解读暂时不可用");
  await expect(page.getByText("基础规则分析")).toBeVisible();
});

test("移动端可查看 AI 智能解读", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-360", "single mobile P2 coverage");
  await useAIMock(page, "success");
  const id = await createLiuyaoReport(request, "移动端 AI 报告是否可读？");
  await page.goto(`/reports/${id}`);
  await expect(page.getByTestId("ai-report-card")).toContainText("AI 智能解读");
  await expect(page.getByTestId("ai-report-card")).toContainText("概要");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
