import { expect, test } from "@playwright/test";

async function createReport(request) {
  const response = await request.post("/api/v1/liuyao/charts", {
    data: {
      question: "体验验收是否能看懂？",
      topic: "career",
      subtype: "job_search",
      values: [7, 8, 9, 7, 8, 6],
      calendar: { timezone: "Asia/Shanghai" },
    },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).chart.id;
}

async function reportText(page) {
  return page.getByTestId("report-page").innerText();
}

test("Guided and Professional report DOM does not leak internal implementation fields", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop experience leakage coverage");
  const id = await createReport(request);
  await page.goto(`/reports/${id}`);
  await expect(page.getByRole("heading", { name: "一句话结论" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "主要支持" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "主要阻碍" })).toBeVisible();
  await expect(page.getByRole("button", { name: "查看依据" })).toBeVisible();
  await expect(page.getByText("专业依据")).toBeVisible();
  const text = await reportText(page);
  for (const forbidden of ["LIUYAO_RULE_", "ruleFindingId", "subject_state", "AI_REPORT_V1", "OPENAI_LIVE", "promptVersion", "undefined", "null", "requestId"]) {
    expect(text).not.toContain(forbidden);
  }
});

test("Experience endpoint separates public and internal presentation", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop experience API coverage");
  const id = await createReport(request);
  const publicResponse = await request.get(`/api/v1/reports/${id}/experience`);
  const publicJson = await publicResponse.json();
  expect(publicJson.experience.guidedViewModel.headline).toBeTruthy();
  expect(publicJson.experience.adminViewModel).toBeFalsy();

  const internalResponse = await request.get(`/internal/reports/${id}/presentation`);
  const internalJson = await internalResponse.json();
  expect(internalJson.adminViewModel.rawFacts.chart).toBeTruthy();
});

test("Mobile report keeps conclusion and next action reachable without overflow", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "mobile experience coverage");
  const id = await createReport(request);
  await page.goto(`/reports/${id}`);
  await expect(page.getByText("一句话结论")).toBeVisible();
  await expect(page.getByRole("button", { name: "查看依据" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
