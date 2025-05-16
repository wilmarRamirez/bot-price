import axios from "axios";
import puppeteer from "puppeteer";
import { utils } from "#utils/index";
import { setupBrowser } from "#config/setupBrowser.config";


/**
 * URL base del sitio web de Challenger a scrapear.
 * @type {string}
 */
const urlWeb = process.env.CHALLENGER_URL;

/**
 * URL base de la API de Zoho para enviar los datos extraídos.
 * @type {string}
 */
const api = process.env.ZOHO_URL;

async function getCategories(page) {
  await page.waitForSelector(".menu-section", { timeout: 5000 });
  return page.evaluate(() => {
    return Array.from(
      document.querySelectorAll(".menu-item-has-children")
    ).flatMap((el) =>
      el.innerText
        .trim()
        .split("/")
        .map((c) => c.trim())
    );
  });
}

async function getProductsUrl(page) {
  return page.evaluate(() => {
    return Array.from(
      document.querySelectorAll(".ag-card-grid ul li a.ag-card__content")
    ).map((item) => item.href);
  });
}

async function extractProductData(page) {
  // eslint-disable-next-line complexity
  return page.evaluate(() => {
    return {
      Categoria_challenger:
        document
          .querySelector(
            ".ag-product-details__cod.codigo-produto .skuReference"
          )
          ?.innerText.trim() || "0",
      Referencia_challenger1:
        document
          .querySelector(
            ".ag-product-details__title.product-name .productName"
          )
          ?.innerText.trim() || "0",
      Precio_Challenger: (
        document.querySelector(".skuBestPrice")?.innerHTML.trim() || "0"
      )
        .replace("$", "")
        .replace(/\./g, ""),
    };
  });
}

async function processCategory(page, urlWeb, category) {
  console.log("Categoría seleccionada:", category);
  await page.goto(`${urlWeb}/${category}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".vitrine", { timeout: 10000 });
  console.log(`Extraer datos de la categoría ${category}`);
  let currentPageNumber = 1;
  let products = [];
  products = await collectProductsFromPages(page, products, currentPageNumber);
  return products;
}

async function collectProductsFromPages(page, products, currentPageNumber) {
  while (true) {
    await waitShortDelay(page);
    const productsUrl = await getProductsUrl(page);
    products = products.concat(await processProductsOnPage(page, productsUrl));
    if (!(await hasNextPage(page))) {
      break;
    }
    const nextPageResult = await tryGoToNextPage(page, currentPageNumber);
    if (!nextPageResult.success) break;
    currentPageNumber = nextPageResult.nextPageNumber;
  }
  return products;
}

async function waitShortDelay(page) {
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 500)));
}

async function tryGoToNextPage(page, currentPageNumber) {
  try {
    const nextPageNumber = await goToNextPage(page, currentPageNumber);
    if (nextPageNumber === null) return { success: false, nextPageNumber: null };
    await page.waitForSelector(".vitrine.resultItemsWrapper ul li", {
      timeout: 10000,
    });
    return { success: true, nextPageNumber };
  } catch (error) {
    console.error(error);
    return { success: false, nextPageNumber: null };
  }
}

async function processProductsOnPage(page, productsUrl) {
  let products = [];
  for (const url of productsUrl) {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 500)));
    const element = await extractProductData(page);
    if (
      element.Categoria_challenger !== "0" &&
      element.Precio_Challenger !== "0" &&
      element.Referencia_challenger1 !== "0"
    ) {
      products.push(element);
    }
    await page.goBack();
  }
  return products;
}

async function hasNextPage(page) {
  const nextPageButton = await page.$(".pager.bottom li.next");
  return !!nextPageButton;
}

async function goToNextPage(page, currentPageNumber) {
  const { nextPageExists, nextPageNumber } = await page.evaluate(() => {
    const currentPage = document.querySelector(".page-number.pgCurrent");
    const nextButton = currentPage?.nextElementSibling;
    return {
      nextPageExists: !!nextButton,
      nextPageNumber: nextButton ? parseInt(nextButton.innerText.trim()) : null,
    };
  });
  if (!nextPageExists) {
    console.log("✅ No hay más páginas. Finalizando...");
    return null;
  }
  if (nextPageNumber === null) return null;
  console.log(`➡️ Avanzando a la página ${nextPageNumber}...`);
  await page.click(".page-number.pgCurrent + li");
  await page.waitForFunction(
    (prevPage) => {
      const newPage = document.querySelector(".page-number.pgCurrent");
      return newPage && parseInt(newPage.innerText.trim()) !== prevPage;
    },
    {},
    currentPageNumber
  );
  return nextPageNumber;
}

async function sendProductsToApi(products, api) {
  let data = [];
  let cont = 0;
  for (const product of products) {
    if (product.Precio_Challenger !== "0") {
      utils.actualizarProgreso((100 / products.length) * (cont + 1));
      data.push(product);
      await axios.request({
        url: `${api}/Precios_Challenger`,
        method: "post",
        data: product,
      });
      cont++;
    }
  }
  return data;
}

async function extractAllProducts(page, urlWeb, listCategory) {
  let allProducts = [];
  for (const category of listCategory) {
    const products = await processCategory(page, urlWeb, category);
    allProducts = allProducts.concat(products);
  }
  return allProducts;
}

async function logExtractionResults(allProducts) {
  console.log("\n✅ Proceso completado.");
  console.log(`Total de productos extraídos: ${allProducts.length}`);
}

async function processExtraction(page, urlWeb) {
  const listCategory = await getCategories(page, urlWeb);
  const allProducts = await extractAllProducts(page, urlWeb, listCategory);
  return allProducts;
}

export const botChallenger = async () => {
  const {browser, page} = await setupBrowser(urlWeb, true);
  console.log("Extraer datos");
  const allProducts = await processExtraction(page, urlWeb, api);
  await browser.close();
  await logExtractionResults(allProducts);
  await sendProductsToApi(allProducts, api);
  console.log("Finalizando ejecución...");
};