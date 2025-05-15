import axios from "axios";
import puppeteer from "puppeteer";
import { utils } from "#utils/index";

const urlWeb = process.env.CHALLENGER_URL;
const api = process.env.ZOHO_URL;

/**
 * Extrae productos de la web de Challenger y los envía a la API de Zoho.
 * Utiliza Puppeteer para navegar por las categorías y productos, y Axios para enviar los datos.
 * @async
 * @function botChallenger
 * @returns {Promise<void>} No retorna nada, pero imprime el progreso y resultados en consola.
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getCategoryList(page) {
  await page.goto(urlWeb, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".menu-section", { timeout: 5000 });
  return await page.evaluate(() =>
    Array.from(document.querySelectorAll(".menu-item-has-children")).map((el) =>
      el.innerText.trim()
    )
  );
}

async function getNumPages(page) {
  return await page.evaluate(
    () =>
      Array.from(
        document.querySelectorAll(".pager.bottom .pages .page-number")
      ).length
  );
}

async function getProductsUrl(page) {
  return await page.evaluate(() => {
    return Array.from(
      document.querySelectorAll(".ag-card-grid ul li a.ag-card__content")
    ).map((item) => item.href);
  });
}

async function getProductData(page) {
  return await page.evaluate(() => {
    function getCategoriaChallenger() {
      const el = document.querySelector(
        ".ag-product-details__cod.codigo-produto .skuReference"
      );
      return el ? el.innerText.trim() : "0";
    }
    function getReferenciaChallenger1() {
      const el = document.querySelector(
        ".ag-product-details__title.product-name .productName"
      );
      return el ? el.innerText.trim() : "0";
    }
    function getPrecioChallenger() {
      const el = document.querySelector(".skuBestPrice");
      if (!el) return "0";
      return el.innerHTML.trim().replace("$", "").replace(/\./g, "");
    }
    return {
      Categoria_challenger: getCategoriaChallenger(),
      Referencia_challenger1: getReferenciaChallenger1(),
      Precio_Challenger: getPrecioChallenger(),
    };
  });
}

async function hasNextPage(page) {
  return await page.$(".pager.bottom li.next");
}

async function getNextPageInfo(page) {
  return await page.evaluate(() => {
    const currentPage = document.querySelector(".page-number.pgCurrent");
    const nextButton = currentPage?.nextElementSibling;
    return {
      nextPageExists: !!nextButton,
      nextPageNumber: nextButton
        ? parseInt(nextButton.innerText.trim())
        : null,
    };
  });
}

async function goToNextPage(page, currentPageNumber) {
  await page.click(".page-number.pgCurrent + li");
  await page.waitForFunction(
    (prevPage) => {
      const newPage = document.querySelector(".page-number.pgCurrent");
      return newPage && parseInt(newPage.innerText.trim()) !== prevPage;
    },
    {},
    currentPageNumber
  );
  await page.waitForSelector(".ag-card-grid.n12colunas ul li", {
    timeout: 50000,
  });
}

async function processProductUrls(page, productsUrl, allProducts) {
  for (const url of productsUrl) {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await delay(500);
    const element = await getProductData(page);
    if (
      element.Categoria_challenger !== "0" &&
      element.Precio_Challenger !== "0" &&
      element.Referencia_challenger1 !== "0"
    ) {
      allProducts.push(element);
    }
    await page.goBack();
  }
}

function handleNoNextPage(currentPageNumber) {
  return { done: true, nextPageNumber: currentPageNumber };
}

function handleNoNextPageExists(currentPageNumber) {
  console.log("✅ No hay más páginas. Finalizando...");
  return { done: true, nextPageNumber: currentPageNumber };
}

function handleNullNextPageNumber(currentPageNumber) {
  return { done: true, nextPageNumber: currentPageNumber };
}

function handlePaginationError(error, currentPageNumber) {
  console.error(
    "❌ Error al hacer clic en 'Siguiente' o cargar la página:",
    error.message
  );
  return { done: true, nextPageNumber: currentPageNumber };
}

function shouldStopOnNoNextPage(nextPageButton, currentPageNumber) {
  if (!nextPageButton) {
    return { stop: true, result: handleNoNextPage(currentPageNumber) };
  }
  return { stop: false };
}

function shouldStopOnNoNextPageExists(nextPageExists, currentPageNumber) {
  if (!nextPageExists) {
    return { stop: true, result: handleNoNextPageExists(currentPageNumber) };
  }
  return { stop: false };
}

function shouldStopOnNullNextPageNumber(nextPageNumber, currentPageNumber) {
  if (nextPageNumber === null) {
    return { stop: true, result: handleNullNextPageNumber(currentPageNumber) };
  }
  return { stop: false };
}

function checkNextPageButton(nextPageButton, currentPageNumber) {
  const stopOnNoNextPage = shouldStopOnNoNextPage(nextPageButton, currentPageNumber);
  if (stopOnNoNextPage.stop) {
    return { shouldReturn: true, result: stopOnNoNextPage.result };
  }
  return { shouldReturn: false };
}

function checkNextPageExists(nextPageExists, currentPageNumber) {
  const stopOnNoNextPageExists = shouldStopOnNoNextPageExists(nextPageExists, currentPageNumber);
  if (stopOnNoNextPageExists.stop) {
    return { shouldReturn: true, result: stopOnNoNextPageExists.result };
  }
  return { shouldReturn: false };
}

function checkNullNextPageNumber(nextPageNumber, currentPageNumber) {
  const stopOnNullNextPageNumber = shouldStopOnNullNextPageNumber(nextPageNumber, currentPageNumber);
  if (stopOnNullNextPageNumber.stop) {
    return { shouldReturn: true, result: stopOnNullNextPageNumber.result };
  }
  return { shouldReturn: false };
}

async function handlePagination(page, currentPageNumber) {
  const nextPageButton = await hasNextPage(page);
  const checkButton = checkNextPageButton(nextPageButton, currentPageNumber);
  if (checkButton.shouldReturn) {
    return checkButton.result;
  }
  try {
    return await handlePaginationStep(page, currentPageNumber);
  } catch (error) {
    return handlePaginationError(error, currentPageNumber);
  }
}

async function handlePaginationStep(page, currentPageNumber) {
  const { nextPageExists, nextPageNumber } = await getNextPageInfo(page);
  const checkExists = checkNextPageExists(nextPageExists, currentPageNumber);
  if (checkExists.shouldReturn) {
    return checkExists.result;
  }
  return await handlePaginationAdvance(page, currentPageNumber, nextPageNumber);
}

async function handlePaginationAdvance(page, currentPageNumber, nextPageNumber) {
  console.log(`➡️ Avanzando a la página ${nextPageNumber}...`);
  const checkNull = checkNullNextPageNumber(nextPageNumber, currentPageNumber);
  if (checkNull.shouldReturn) {
    return checkNull.result;
  }
  await goToNextPage(page, currentPageNumber);
  return { done: false, nextPageNumber };
}

async function navigateToCategory(page, category) {
  await page.goto(`${urlWeb}/${category}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector(".vitrine", { timeout: 10000 });
}

async function logCategoryInfo(page, category) {
  const next = await getNumPages(page);
  console.log(`Páginas a rastrear de la categoría ${category} :`, next);
  console.log(`Extraer datos de la categoría ${category}`);
}

async function extractProductsFromCategory(page, category) {
  let allProducts = [];
  console.log("Categoría seleccionada:", category);

  await navigateToCategory(page, category);
  await logCategoryInfo(page, category);

  let currentPageNumber = 1;

  allProducts = await extractAllPagesProducts(page, allProducts, currentPageNumber);

  return allProducts;
}

async function extractAllPagesProducts(page, allProducts, currentPageNumber) {
  while (true) {
    await delay(500);
    const productsUrl = await getProductsUrl(page);
    await processProductUrls(page, productsUrl, allProducts);

    const { done, nextPageNumber } = await handlePagination(page, currentPageNumber);
    if (done) break;
    currentPageNumber = nextPageNumber;
  }
  return allProducts;
}

async function sendProductsToApi(products) {
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

async function extractAllProducts(page, listCategory) {
  let allProducts = [];
  for (const category of listCategory) {
    const products = await extractProductsFromCategory(page, category);
    allProducts = allProducts.concat(products);
  }
  return allProducts;
}

async function prepareBrowserAndPage() {
  const browser = await puppeteer.launch({
    headless: false,
    args: [`--window-size=1880,980`],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1880, height: 980 });
  return { browser, page };
}

async function runBotChallenger() {
  const { browser, page } = await prepareBrowserAndPage();
  console.log("Extraer datos");

  const listCategory = await getCategoryList(page);
  const allProducts = await extractAllProducts(page, listCategory);

  await browser.close();
  console.log("\n✅ Proceso completado.");
  console.log(`Total de productos extraídos: ${allProducts.length}`);
  await sendProductsToApi(allProducts);
  console.log("Finalizando ejecución...");
}

export const botChallenger = runBotChallenger;