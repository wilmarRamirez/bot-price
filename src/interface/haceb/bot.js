//A import axios from "axios";
import { setupBrowser } from "#config/setupBrowser.config";
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

function validateArray(params) {
  const organize = params.filter(
    (obj, index, self) => index === self.findIndex((t) => t.text === obj.text)
  );
  console.log(
    "Categorías filtradas para eliminar duplicados:",
    organize.length
  );

  return organize;
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

  const data1 = categories.map((el) => {
    const text = el.text.replace(/Electrodomésticos/g, "");
    return {
      text: text
        .replace(/\bde\b/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    };
  });

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
  return validateArray([...categories, ...data1]);
}

async function clickBtn(page) {
  try {
    console.log("⏳ Esperando el botón de cargar más...");

    await page.waitForSelector("a.vtex-button", { timeout: 5000 });

    await page.click("a.vtex-button");

    console.log("✅ Botón encontrado y clic realizado correctamente.");
    return true; // Exito
  } catch (error) {
    console.log("❌ No se encontró el botón o falló el clic:", error.message);
    return false; // Fallo
  }
}

async function navigateToCategory(page, category) {
  const url = `${urlWeb}/${encodeURIComponent(category.text)}`;
  await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
}

async function waitForCategoryContent(page, category) {
  try {
    await waitForMainCategoryContent(page);
    let cuantity = await getCategoryProductCount(page);
    const totalPages = Math.ceil(cuantity / 12);
    console.log(`🧾 Cantidad total estimada de páginas: ${totalPages}`);

    await loadAllCategoryPages(page, totalPages);

    await delay(2000); // Pequeña espera final
    return true; // Retorna true si se cargó el contenido
  } catch {
    console.log(
      `❌ No se encontró la categoría "${category.text}" o falló el proceso.`
    );
    return false;
  }
}

async function waitForMainCategoryContent(page) {
  // Espera a que cargue el contenido principal de la categoría
  await page.waitForSelector(
    ".vtex-flex-layout-0-x-flexCol.vtex-flex-layout-0-x-flexCol--content",
    { timeout: 5000 }
  );
}

async function getCategoryProductCount(page) {
  // Obtener la cantidad de productos
  let cuantity = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("div.t-action--small span"))
      .map((el) => el.innerText.trim())
      .join(" ");
  });

  // Extraer el número
  cuantity = parseInt(cuantity.split(" ")[0].replace(/\D/g, ""), 10) || 0;
  return cuantity;
}

async function loadAllCategoryPages(page, totalPages) {
  // Cargar más páginas si hay
  for (let i = 1; i < totalPages; i++) {
    await delay(2000); // Espera real de 2 segundos
    const btn = await clickBtn(page);
    if (!btn) {
      console.log("🚫 No se pudo hacer clic en el botón de cargar más.");
      break;
    }
  }
}

// Función de delay auxiliar
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function extractCategoryProducts(page) {
  setTimeout(() => {}, 1000);
  let products = [];

  const nuevos = await page.evaluate(() => {
    return Array.from(
      document.querySelectorAll(
        ".vtex-search-result-3-x-galleryItem.vtex-search-result-3-x-galleryItem--normal.vtex-search-result-3-x-galleryItem--department"
      )
    ).map((el) => ({
      text: el.innerText.trim(),
    }));
  });

  // Agrega los nuevos productos al array plano (sin subarrays)
  products = nuevos;
  console.log("Cantidad de productos extraídos:", products.length);
  return products;
}

async function processCategory(page, category) {
  console.log(`Navegando a la categoría: ${category.text}...`);
  await navigateToCategory(page, category);

  const contentReady = await waitForCategoryContent(page, category);
  if (!contentReady) return [];
  setTimeout(() => {}, 1000);
  const data = await extractCategoryProducts(page);
  console.log(
    `Productos extraídos de la categoría ${category.text}:`,
    data.length
  );
  return data;
}

async function extractProducts(page, categories) {
  const products = [];
  for (const category of categories) {
    const data = await processCategory(page, category);
    products.push(...data);
  }
  return products;
}

export const botHaceb = async () => {
  const { browser, page } = await setupBrowser(urlWeb, false);
  await openMenu(page);
  const categories = await extractCategories(page);
  const products = await extractProducts(page, categories);
  console.log("Productos extraídos:", products.length);

  await browser.close();
};
