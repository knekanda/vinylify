import { test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import * as fs from "fs";

test.describe("Vinylify UI Audit", () => {
  test("captures screenshots + axe-core accessibility", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Desktop screenshot
    await page.screenshot({ path: "qa/screenshots/home-1440.png" });

    // Tablet screenshot
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: "qa/screenshots/home-768.png" });

    // Mobile screenshot
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: "qa/screenshots/home-390.png" });

    // Back to desktop for axe
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);

    // axe-core accessibility audit
    const axeResults = await new AxeBuilder({ page }).analyze();

    const report = {
      url: axeResults.url,
      timestamp: axeResults.timestamp,
      violations: axeResults.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.length,
        help: v.help,
        helpUrl: v.helpUrl,
        tags: v.tags,
      })),
      passes: axeResults.passes.length,
      incomplete: axeResults.incomplete.length,
      inapplicable: axeResults.inapplicable.length,
    };

    fs.mkdirSync("qa/screenshots", { recursive: true });
    fs.writeFileSync(
      "qa/screenshots/axe-results.json",
      JSON.stringify(report, null, 2)
    );

    console.log(
      `axe: ${report.violations.length} violations, ${report.passes} passes, ${report.incomplete} incomplete`
    );
    report.violations.forEach((v) =>
      console.log(`  [${v.impact}] ${v.id}: ${v.description} (${v.nodes} nodes)`)
    );
  });
});
