import { expect, test } from "@playwright/test";

const apiBaseURL = process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:4100/api/v1";

async function createReport(request) {
  const response = await request.post(`${apiBaseURL}/liuyao/charts`, {
    data: {
      question: "体验验收是否能看懂？",
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

async function reportText(page) {
  return page.getByTestId("report-page").innerText();
}

test("Homepage guides users from value to scenario and one focused question", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "把一件难事，看清方向与下一步" })).toBeVisible();
  await expect(page.getByRole("link", { name: "从我的问题开始" })).toBeVisible();

  await page.getByRole("link", { name: "从我的问题开始" }).click();
  await expect(page.getByRole("heading", { name: "你现在最想看清哪件事？" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "感情与合作" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab")).toHaveCount(4);
  await expect(page.getByRole("radio")).toHaveCount(2);
  await expect(page.getByRole("radio", { name: /感情 \/ 关系/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /合作 \/ 项目/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /事业 \/ 工作/ })).toBeHidden();

  await page.getByRole("tab", { name: "工作与钱" }).click();
  await expect(page.getByRole("radio", { name: /事业 \/ 工作/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /求财 \/ 收入/ })).toBeVisible();

  await page.getByRole("tab", { name: "生活事务" }).click();
  await expect(page.getByRole("radio")).toHaveCount(3);
  await page.getByRole("radio", { name: /房产 \/ 居所/ }).click();
  await expect(page.getByText("计划是否具备推进条件", { exact: true })).toBeVisible();
  await expect(page.getByText("手续、资金或时间哪里会卡", { exact: true })).toBeVisible();
  await expect(page.getByText("什么时候调整更稳妥", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "按这个场景继续" }).click();
  await expect(page.getByRole("heading", { name: "写下此刻最想确认的一件事" })).toBeVisible();
  await page.getByRole("button", { name: "这次搬迁计划是否需要调整？" }).click();
  await expect(page.getByRole("textbox", { name: /你的问题/ })).toHaveValue("这次搬迁计划是否需要调整？");
  await expect(page.getByRole("button", { name: "就问这个问题" })).toBeEnabled();

  await page.getByRole("button", { name: "就问这个问题" }).click();
  await expect(page.getByRole("heading", { name: "确认问题，开始起卦" })).toBeVisible();
  await expect(page.getByText("排盘与判断依据不会由 AI 改写", { exact: true })).toBeVisible();
  await expect(page.getByText("更换起卦方式", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "我自己逐爻摇" })).toBeHidden();
  await page.getByRole("button", { name: "开始起卦", exact: true }).click();
  await expect(page.getByText("起卦已完成", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "生成我的六爻报告" })).toBeEnabled();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});

test("Knowledge center guides users by goal, stage, topic, and report order", async ({ page }) => {
  await page.goto("/content");

  await expect(page.getByRole("heading", { name: "按你的目标，找到下一步" })).toBeVisible();
  await expect(page.locator(".hub-metrics")).toContainText("603");
  await expect(page.locator(".hub-metrics")).toContainText("6个现实问题专题");
  await expect(page.locator(".learning-intent")).toHaveCount(3);
  await expect(page.locator(".learning-rail .path-step")).toHaveCount(6);
  await expect(page.locator(".path-step.active")).toContainText("先知道怎么使用");
  await expect(page.locator(".stage-reading-list a")).toHaveCount(3);

  await page.getByRole("button", { name: /理解起卦与盘面/ }).click();
  await expect(page.locator(".stage-panel h3")).toHaveText("理解起卦与盘面");

  await expect(page.locator(".topic-card")).toHaveCount(6);
  const topicImages = await page.locator(".topic-card img").evaluateAll((images) => images.map((image) => image.getAttribute("src")));
  expect(new Set(topicImages).size).toBe(6);
  const topicImageAlts = await page.locator(".topic-card img").evaluateAll((images) => images.map((image) => image.getAttribute("alt")));
  expect(topicImageAlts.every((alt) => Boolean(alt))).toBe(true);

  await expect(page.locator(".report-step-card")).toHaveCount(4);
  await expect(page.locator(".report-step-card").first()).toContainText("先确认报告在回答什么");
  await expect(page.locator(".report-step-card").last()).toContainText("最后核对专业依据");
  await expect(page.locator(".library-module-select select")).toHaveValue("B01");
  await expect(page.locator(".library-list .content-card")).toHaveCount(12);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});

test("Topic detail uses scenario-specific copy, visual, and reading lenses", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop topic detail coverage");
  await page.goto("/content/landing-page/relationship");

  await expect(page.getByRole("heading", { name: "感情与关系", level: 1 })).toBeVisible();
  await expect(page.getByText("看清关系正在靠近还是疏远、互动为什么反复，以及现在更适合沟通还是观察。", { exact: true })).toBeVisible();
  await expect(page.locator(".topic-detail-hero img")).toHaveAttribute("src", "/liuyao-visual-system/topics/topic-relationship-field.svg");
  await expect(page.locator(".topic-detail-hero img")).toHaveAttribute("alt", /双向关系场/);
  await expect(page.locator(".topic-method-grid strong")).toHaveCount(4);
  await expect(page.locator(".topic-method-grid")).toContainText("互动卡点");
  await expect(page.locator("body")).not.toContainText("用六爻整理感情与关系中的现实决策问题");
});

test("Tutorial article separates guidance from internal notes and exposes related formats", async ({ page }) => {
  await page.goto("/content/tutorial/why-not-repeat-liuyao-readings");

  await expect(page.getByRole("heading", { name: "为什么不建议对同一个问题反复起卦", level: 1 })).toBeVisible();
  await expect(page.locator(".article-deck")).toContainText("保存第一次报告，观察现实");
  await expect(page.locator(".article-takeaway-grid > div")).toHaveCount(4);
  await expect(page.locator(".article-resource-nav [role=tab]")).toHaveCount(3);
  await expect(page.locator(".knowledge-card-list a")).toHaveCount(3);

  await page.locator(".article-resource-nav").getByRole("tab", { name: /常见问答/ }).click();
  await expect(page.locator(".faq-link-list a")).toHaveCount(4);
  await page.locator(".article-resource-nav").getByRole("tab", { name: /延伸教程/ }).click();
  await expect(page.locator(".tutorial-link-list a")).toHaveCount(3);
  await expect(page.locator("body")).not.toContainText("从寻找确定感，转向记录、验证与条件变化");
  await expect(page.locator("body")).not.toContainText("在产品中的阅读、展开与复盘位置");
  await expect(page.locator("body")).not.toContainText("CORE_V1");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});

test("Article image zoom and Chinese related routes work", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop interaction coverage");
  await page.goto("/content/tutorial/why-not-repeat-liuyao-readings");

  await page.getByRole("button", { name: /放大查看：为什么不建议/ }).first().click();
  await expect(page.getByRole("dialog", { name: /为什么不建议/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: /为什么不建议/ })).toBeHidden();

  await page.locator(".knowledge-card-list a").first().click();
  await expect(page.getByRole("heading", { name: "起卦时点", level: 1 })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("未找到内容");

  await page.goto("/content/tutorial/why-not-repeat-liuyao-readings");
  await page.locator(".article-resource-nav").getByRole("tab", { name: /常见问答/ }).click();
  await page.locator(".faq-link-list a").first().click();
  await expect(page.getByRole("heading", { name: "什么时候适合起卦？", level: 1 })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("未找到内容");
});

test("Glossary entry uses a compact term layout", async ({ page }) => {
  await page.goto("/content/glossary/useful_god");

  await expect(page.getByRole("heading", { name: "用神", level: 1 })).toBeVisible();
  await expect(page.locator(".reference-definition")).toHaveText("针对具体问题选定的主要观察角色或爻。");
  await expect(page.getByRole("heading", { name: "和“用神”一起理解的概念" })).toBeVisible();
  await expect(page.locator(".knowledge-card-list a")).toHaveCount(3);
  await expect(page.locator("body")).not.toContainText("示例内容");
  await expect(page.locator("body")).not.toContainText("本文还配有");
  await expect(page.locator("body")).not.toContainText("按需要选择，不必再翻一组长列表");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});

test("Guided and Professional report DOM does not leak internal implementation fields", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop experience leakage coverage");
  const id = await createReport(request);
  await page.goto(`/reports/${id}`);
  await expect(page.getByRole("heading", { name: "总体判断" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "主要支持", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "主要阻碍", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "为什么这样判断" })).toBeVisible();
  await expect(page.getByRole("link", { name: "查看依据" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "专业依据" })).toBeVisible();
  await page.locator(".ly-advanced-disclosure > summary").click();
  await expect(page.locator('[data-visual-id="VIS-LY-011"]')).toBeVisible();
  await expect(page.locator('[data-visual-id="VIS-LY-012"]')).toBeVisible();
  await expect(page.locator('[data-visual-id="VIS-LY-013"]')).toBeVisible();
  await expect(page.locator('[data-visual-id="VIS-LY-014"]')).toBeVisible();
  await expect(page.locator(".ly-visual-system")).not.toContainText("Pattern and conflict policy");
  await expect(page.getByTestId("export-visual-svg")).toBeVisible();
  await expect(page.getByTestId("print-report")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-visual-svg").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/-visual-report\.svg$/u);
  const text = await reportText(page);
  for (const forbidden of ["LIUYAO_RULE_", "ruleFindingId", "subject_state", "AI_REPORT_V1", "OPENAI_LIVE", "promptVersion", "undefined", "null", "requestId"]) {
    expect(text).not.toContain(forbidden);
  }
});

test("Experience endpoint separates public and internal presentation", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop experience API coverage");
  const id = await createReport(request);
  const publicResponse = await request.get(`${apiBaseURL}/reports/${id}/experience`);
  const publicJson = await publicResponse.json();
  expect(publicJson.experience.guidedViewModel.headline).toBeTruthy();
  expect(publicJson.experience.adminViewModel).toBeFalsy();

  const internalResponse = await request.get(`${apiBaseURL}/reports/${id}/internal-presentation`);
  const internalJson = await internalResponse.json();
  expect(internalJson.adminViewModel.rawFacts.chart).toBeTruthy();
});

test("Mobile report keeps conclusion and next action reachable without overflow", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "mobile experience coverage");
  const id = await createReport(request);
  await page.goto(`/reports/${id}`);
  await expect(page.getByRole("heading", { name: "总体判断" })).toBeVisible();
  await expect(page.getByRole("link", { name: "查看依据" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
