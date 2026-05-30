const { chromium } = await import('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:4321');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshot.png' });
  await browser.close();
})();
