const puppeteer = require("puppeteer");

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    await page.goto("http://localhost:3000/learn", { waitUntil: "networkidle0" });

    // Ensure n=15, a=2 is selected
    // Click on "2. QFT Peaks"
    const buttons = await page.$$("button");
    for (const b of buttons) {
      const text = await (await b.getProperty("textContent")).jsonValue();
      if (text.includes("2. QFT Peaks")) {
        await b.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 800));

    // Inspect the bar elements in the chart
    const chartInfo = await page.evaluate(() => {
      const container = document.querySelector(".overflow-x-auto .min-w-\\[500px\\]");
      if (!container) return { error: "chart container not found" };

      const groups = Array.from(container.querySelectorAll(".group"));
      return {
        containerHeight: container.getBoundingClientRect().height,
        containerWidth: container.getBoundingClientRect().width,
        barCount: groups.length,
        bars: groups.map((g) => {
          const innerBar = g.querySelector("div[style*='height']");
          const label = g.querySelector(".truncate") || g.lastElementChild;
          const cs = innerBar ? window.getComputedStyle(innerBar) : null;
          const rect = innerBar ? innerBar.getBoundingClientRect() : null;
          const groupRect = g.getBoundingClientRect();
          return {
            xLabel: label ? label.textContent.trim() : "",
            inlineStyle: innerBar ? innerBar.getAttribute("style") : "",
            computedHeight: cs ? cs.height : "N/A",
            computedWidth: cs ? cs.width : "N/A",
            computedBackgroundColor: cs ? cs.backgroundColor : "N/A",
            computedBackgroundImage: cs ? cs.backgroundImage : "N/A",
            rectHeight: rect ? rect.height : 0,
            rectWidth: rect ? rect.width : 0,
            groupHeight: groupRect.height,
            groupWidth: groupRect.width,
            classes: innerBar ? innerBar.className : "",
          };
        }),
      };
    });

    console.log(JSON.stringify(chartInfo, null, 2));
    await browser.close();
  } catch (err) {
    console.error("Error inspecting:", err);
  }
})();
