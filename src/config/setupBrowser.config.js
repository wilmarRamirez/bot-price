import puppeteer from "puppeteer";

/**
 * URL base del sitio web de haceb a scrapear.
 * @type {string}
 */
// const urlWeb = process.env.HACEB_URL;

export async function setupBrowser(urlWeb, server) {
  const browser = await puppeteer.launch({
    headless: server,
    args: [
      `--window-size=1950,980`,
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1950, height: 980 });
  await page.goto(urlWeb, { waitUntil: "domcontentloaded" });
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
  );
  return { browser, page };
}
