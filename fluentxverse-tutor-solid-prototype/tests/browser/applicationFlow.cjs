const { chromium, expect } = require("@playwright/test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const base = process.env.TUTOR_TEST_URL || "http://127.0.0.1:5188";
const output = "../output/screenshots/tutor-application";
const readAloudOnly = process.env.READ_ALOUD_ONLY === '1';
const task = (id) =>
  readAloudOnly || id <= 3
    ? {
        id,
        type: "read-aloud",
        sentence: "A lesson begins.",
        instruction: "Read the sentence.",
        timeLimit: 30,
      }
    : id <= 5
      ? {
          id,
          type: "picture-description",
          imageUrl: "/assets/img/banner/about_hero.webp",
          instruction: "Describe the image.",
          timeLimit: 60,
        }
      : {
          id,
          type: "open-response",
          question: "How do you encourage a learner?",
          instruction: "Explain your approach.",
          timeLimit: 60,
        };
const exam = {
  ...(readAloudOnly ? { format: 'read-aloud.v1' } : {}),
  examId: "SPEAK-browser",
  title: "Oral screening",
  description: "Test",
  passingScore: 85,
  totalTimeLimit: 20,
  startedAt: new Date().toISOString(),
  tasks: Array.from({ length: 10 }, (_, i) => task(i + 1)),
};

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    executablePath: "/usr/bin/google-chrome",
    args: [
      "--no-sandbox",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  });
  try {
    for (const width of [1440, 375, 320]) {
      const context = await browser.newContext({
        viewport: { width, height: 950 },
        permissions: ["microphone"],
      });
      await context.addInitScript(() => {
        AnalyserNode.prototype.getByteFrequencyData = (data) => data.fill(30);
      });
      let writtenPass = false,
        state = "active",
        saved = [1, 2, 3],
        failUpload = true,
        uploadCount = 0;
      let queuedReads = 0;
      const requested = [],
        errors = [];
      const status = () => ({
        hasActiveExam: state === "active",
        hasCompletedExam: state === "completed",
        isProcessing: state === "queued",
        gradingFailed: state === "grading_failed",
        canRetryGrading: true,
        passed: state === "completed" ? true : null,
        examId: exam.examId,
        percentage: state === "completed" ? 100 : null,
        attemptsThisMonth: 0,
        maxAttemptsPerMonth: 2,
      });
      await context.route("**/*", async (route) => {
        const url = new URL(route.request().url()),
          path = url.pathname;
        if (url.origin === base) return route.continue();
        requested.push(path);
        let json = { success: true, data: [] };
        if (path === "/tutor/me")
          json.user = {
            userId: "qa-browser",
            firstName: "Alex",
            email: "qa@example.invalid",
            role: "tutor",
          };
        if (path.replace(/\/$/, '') === '/tutor/email-verification')
          json.data = { verified: true, assessmentComplete: false, email: 'qa@example.invalid', sender: 'tutor@fluentxverse.com', resendAvailableAt: 0, deliveryStatus: 'accepted' };
        if (path === "/exam/status")
          json.status = {
            passed: writtenPass ? true : null,
            hasCompletedExam: writtenPass,
            percentage: writtenPass ? 100 : null,
            attemptsThisMonth: 0,
            maxAttemptsPerMonth: 2,
          };
        if (path === "/exam/speaking/status") {
          if (state === "queued" && ++queuedReads >= 3) state = "completed";
          json.status = status();
        }
        if (path === "/exam/speaking/active")
          json.exam = { ...exam, savedTaskIds: saved };
        if (path === "/exam/speaking/recording") {
          uploadCount++;
          const body = route.request().postDataJSON();
          assert.equal(body.recording.taskId, saved.includes(4) ? 10 : 4);
          assert(body.recording.audioUrl.startsWith("data:audio/"));
          assert(!("transcription" in body.recording));
          if (failUpload) {
            failUpload = false;
            return route.fulfill({
              status: 503,
              json: { message: "Temporary upload interruption." },
            });
          }
          saved = [...saved, body.recording.taskId];
          json = { success: true, saved: true, taskId: body.recording.taskId };
        }
        if (
          path === "/exam/speaking/submit" ||
          path === "/exam/speaking/retry"
        ) {
          const body = route.request().postDataJSON();
          assert.deepEqual(Object.keys(body), ["examId"]);
          state = "queued";
          queuedReads = 0;
          return route.fulfill({ status: 202, json: { success: true, state } });
        }
        if (path.startsWith("/exam/speaking/result/"))
          json.result = {
            ...(readAloudOnly ? { format: 'read-aloud.v1' } : {}),
            examId: exam.examId,
            passed: true,
            overallScore: 100,
            taskScores: [],
            sectionAverages: {
              pronunciation: null,
              fluency: null,
              vocabulary: 5,
              grammar: 5,
              coherence: 5,
              taskCompletion: 5,
            },
            overallFeedback:
              "Content screening passed. Human interview required.",
          };
        if (path.includes("/notifications"))
          json.data = { notifications: [], unreadCount: 0 };
        if (path.includes("/unread-count")) json.data = { unreadCount: 0 };
        if (path.includes("/my-booking")) json.data = null;
        if (path.includes("/proof/")) json = { success: false };
        return route.fulfill({ json });
      });
      await context.routeWebSocket("**/*", (ws) => ws.close());
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(base + "/home", { waitUntil: "networkidle" });
      await expect(
        page.getByRole("button", { name: /WRITTEN PASS REQUIRED/ }),
      ).toBeDisabled();
      await page.goto(base + "/exam/speaking", { waitUntil: "networkidle" });
      await expect(
        page.getByRole("button", { name: "Written Exam Pass Required" }),
      ).toBeDisabled();
      writtenPass = true;
      await page.reload({ waitUntil: "networkidle" });
      const equipment = async () => {
        await page.getByRole("button", { name: "Test Your Equipment" }).click();
        await page.getByRole("button", { name: /Microphone Works/ }).click();
        await page.getByRole("button", { name: /Yes.*heard/i }).click();
        await page.getByRole("button", { name: /Start.*Exam/i }).click();
      };
      await equipment();
      await expect(
        page.getByText("Task 4 of 10", { exact: true }),
      ).toBeVisible();
      if (readAloudOnly) {
        await expect(page.locator('.read-aloud-text')).toHaveText('A lesson begins.');
        await expect(page.locator('.task-image-container')).toHaveCount(0);
      } else await expect.poll(async () => page
          .locator(".task-image-container img")
          .evaluate((el) => el.complete && el.naturalWidth > 0),
        { timeout: 15000, message: "The assessment image must finish loading and decode." },
      ).toBe(true);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${width}: task fits`,
      );
      await page.screenshot({
        path: `${output}/resumed-task-${width}.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: /Start Recording/ }).click();
      await page.waitForTimeout(750);
      await page.getByRole("button", { name: /Done Speaking/ }).click();
      await expect(
        page.getByRole("heading", { name: "Assessment Paused" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Retry Saving Recording" })
        .click();
      await expect(
        page.getByText("Task 5 of 10", { exact: true }),
      ).toBeVisible();
      assert.equal(uploadCount, 2);
      await page.reload({ waitUntil: "networkidle" });
      await equipment();
      await expect(
        page.getByText("Task 5 of 10", { exact: true }),
      ).toBeVisible();
      // Resume the final saved task to exercise asynchronous submission without a 10-minute recording run.
      saved = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      await page.reload({ waitUntil: "networkidle" });
      await equipment();
      await expect(
        page.getByText("Task 10 of 10", { exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: /Start Recording/ }).click();
      await page.waitForTimeout(750);
      await page.getByRole("button", { name: /Done Speaking/ }).click();
      await expect(
        page.getByRole("heading", { name: "Processing Your Exam" }),
      ).toBeVisible();
      await page.reload({ waitUntil: "networkidle" });
      await expect(
        page.getByRole("heading", { name: readAloudOnly ? "Read-Aloud Results" : "Speaking Exam Results" }),
      ).toBeVisible({ timeout: 20000 });
      await expect(page.getByText("Human review", { exact: true })).toHaveCount(
        2,
      );
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${width}: results fit`,
      );
      await page.screenshot({
        path: `${output}/content-result-${width}.png`,
        fullPage: true,
      });
      assert(requested.includes("/exam/speaking/active"));
      assert(requested.includes("/exam/speaking/result/SPEAK-browser"));
      assert(
        !requested.some((path) =>
          /\/active\/qa-browser|\/result\/qa-browser/.test(path),
        ),
      );
      assert.deepEqual(errors, []);
      console.log(
        `PASS ${width}: prerequisites, saved-task resume, photo asset, upload retry, refresh, asynchronous results, nullable acoustic scores`,
      );
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
