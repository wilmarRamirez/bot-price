import axios from "axios";
import puppeteer from "puppeteer";
import readline from "readline";

/**
 * Muestra el progreso de carga en la consola.
 * @param {number} progreso - Porcentaje de progreso a mostrar (0-100).
 */
function actualizarProgreso(progreso) {
  readline.cursorTo(process.stdout, 0);
  process.stdout.write(`Cargando: ${progreso.toFixed(2)}%\r`);
}

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

/**
 * Extrae productos de la web de Challenger y los envía a la API de Zoho.
 * Utiliza Puppeteer para navegar por las categorías y productos, y Axios para enviar los datos.
 *
 * @async
 * @function botChallenger
 * @returns {Promise<void>} No retorna nada, pero imprime el progreso y resultados en consola.
 */
export const botChallenger = async () => {
  /**
   * Instancia del navegador Puppeteer.
   * @type {import('puppeteer').Browser}
   */
  const browser = await puppeteer.launch({
    headless: "new", // O true
    args: [`--window-size=1880,980`, "--no-sandbox", "--disable-setuid-sandbox"],
  });

  /**
   * Página principal de navegación.
   * @type {import('puppeteer').Page}
   */
  const page = await browser.newPage();
  await page.setViewport({ width: 1880, height: 980 });
  console.log("Extraer datos");

  await page.goto(urlWeb, {
    waitUntil: "domcontentloaded",
  });

  await page.waitForSelector(".menu-section", { timeout: 5000 });

  /**
   * Lista de categorías extraídas del menú principal.
   * @type {string[]}
   */
  const listCategory = await page.evaluate(() => {
    return Array.from(
      document.querySelectorAll(".menu-item-has-children")
    ).flatMap((el) =>
      el.innerText
        .trim()
        .split("/")
        .map((c) => c.trim())
    );
  });

  /**
   * Almacena todos los productos extraídos de todas las categorías.
   * @type {Array<{Categoria_challenger: string, Referencia_challenger1: string, Precio_Challenger: string}>}
   */
  let allProducts = [];

  for (const category of listCategory) {
    console.log("Categoría seleccionada:", category);

    await page.goto(`${urlWeb}/${category}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector(".vitrine", { timeout: 10000 });

    console.log(`Extraer datos de la categoría ${category}`);
    let currentPageNumber = 1;

    while (true) {
      await page.evaluate(
        () => new Promise((resolve) => setTimeout(resolve, 500))
      );

      /**
       * URLs de los productos en la página actual.
       * @type {string[]}
       */
      const productsUrl = await page.evaluate(() => {
        return Array.from(
          document.querySelectorAll(".ag-card-grid ul li a.ag-card__content")
        ).map((item) => item.href);
      });

      for (const url of productsUrl) {
        await page.goto(url, { waitUntil: "domcontentloaded" });
        await page.evaluate(
          () => new Promise((resolve) => setTimeout(resolve, 500))
        );

        /**
         * Elemento con los datos del producto extraído de la página.
         * @type {{Categoria_challenger: string, Referencia_challenger1: string, Precio_Challenger: string}}
         */
        const element = await page.evaluate(() => {
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

        if (
          element.Categoria_challenger !== "0" &&
          element.Precio_Challenger !== "0" &&
          element.Referencia_challenger1 !== "0"
        ) {
          allProducts = allProducts.concat(element);
        }
        await page.goBack();
      }

      const nextPageButton = await page.$(".pager.bottom li.next");

      if (!nextPageButton) {
        break;
      }

      try {
        /**
         * Información sobre la existencia de la siguiente página y su número.
         * @type {{nextPageExists: boolean, nextPageNumber: number|null}}
         */
        const { nextPageExists, nextPageNumber } = await page.evaluate(() => {
          const currentPage = document.querySelector(".page-number.pgCurrent");
          const nextButton = currentPage?.nextElementSibling; // Siguiente página

          return {
            nextPageExists: !!nextButton,
            nextPageNumber: nextButton
              ? parseInt(nextButton.innerText.trim())
              : null,
          };
        });

        if (!nextPageExists) {
          console.log("✅ No hay más páginas. Finalizando...");
          break;
        }

        if (nextPageNumber === null) break;
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

        currentPageNumber = nextPageNumber;

        await page.waitForSelector(".vitrine.resultItemsWrapper ul li", {
          timeout: 10000,
        });
      } catch (error) {
        console.error(error);
        break;
      }
    }
  }

  await browser.close();

  /**
   * Almacena los productos que serán enviados a la API.
   * @type {Array<{Categoria_challenger: string, Referencia_challenger1: string, Precio_Challenger: string}>}
   */
  let data = [];
  console.log("\n✅ Proceso completado.");
  console.log(`Total de productos extraídos: ${allProducts.length}`);
  let cont = 0;
  for (const product of allProducts) {
    if (product.Precio_Challenger !== "0") {
      actualizarProgreso((100 / allProducts.length) * (cont + 1));
      data.push(product);
      await axios.request({
        url: `${api}/Precios_Challenger`,
        method: "post",
        data: product,
      });
      cont++;
    }
  }

  console.log("Finalizando ejecución...");
};