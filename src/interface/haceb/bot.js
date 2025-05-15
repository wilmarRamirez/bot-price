//A import axios from "axios";
import puppeteer from "puppeteer";
//A import { utils } from "#utils/index";

/**
 * URL base del sitio web de haceb a scrapear.
 * @type {string}
 */
const urlWeb = process.env.HACEB_URL;

/**
 * URL base de la API de Zoho para enviar los datos extraídos.
 * @type {string}
 */
// const api = process.env.ZOHO_URL;

async function setupBrowser() {
  const browser = await puppeteer.launch({
    headless: false,
    args: [`--window-size=950,980`, "--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1950, height: 980 });
  await page.goto(urlWeb, { waitUntil: "domcontentloaded" });
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
  );
  return { browser, page };
}

async function openMenu(page) {
  await page.waitForSelector(
    ".hacebco-menu-drawer-0-x-drawerTriggerContainer--drawer-desktop",
    { timeout: 10000 }
  );
  await page.click(
    ".hacebco-menu-drawer-0-x-drawerTriggerContainer--drawer-desktop"
  );
  await page.evaluate(() => {
    const menuBtn = document.querySelector(
      ".hacebco-menu-drawer-0-x-drawerTriggerContainer--drawer-desktop"
    );
    if (menuBtn) menuBtn.click();
  });
  console.log("Menú lateral abierto");
}

async function extractCategories(page) {
  await page.waitForSelector(".hacebco-menu-drawer-0-x-itemList", {
    timeout: 20000,
  });
  const categories = await page.evaluate(() => {
    return Array.from(
      document.querySelectorAll(".hacebco-menu-drawer-0-x-menuItemIconText")
    ).map((el) => ({
      text: el.innerText.trim(),
    }));
  });
  categories.pop();
  categories.map((el) => {
    if (el.text.includes("Electrodomésticos")) {
      el.text = el.text
        .replace(/Electrodomésticos/g, "")
        .replace(/\bde\b/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }
    el.text = el.text.replace(/[\u200B-\u200D\uFEFF]/g, "");
    el.text = el.text.replace(/[\u00A0]/g, "");
    el.text = el.text.replace(/ /g, "-");
    return el;
  });
  return categories;
}

async function extractProducts(page, categories) {
  for (const category of categories) {
    console.log(`Navegando a la categoría: ${category.text}...`);
    const url = `${urlWeb}/${encodeURIComponent(category.text)}`;
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
  }
}

export const botHaceb = async () => {
  const { browser, page } = await setupBrowser();
  await openMenu(page);
  const categories = await extractCategories(page);
  console.log("Categorías desde el menú lateral:", categories);
  await extractProducts(page, categories);

  await browser.close();
};
