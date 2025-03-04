import axios from "axios";
import puppeteer from "puppeteer";
import readline from "readline";

function actualizarProgreso(progreso) {
  readline.cursorTo(process.stdout, 0);
  process.stdout.write(`Cargando: ${progreso.toFixed(2)}%\r`);
}

(async () => {
    const browser = await puppeteer.launch({
        headless: false, // Para ver el navegador en acción
        args: [`--window-size=180,580`] // Establece el tamaño de la ventana
      });
    
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 }); // Ajusta el viewport
  console.log("Extraer datos");

  await page.goto(`https://www.challenger.com.co`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector(".menu-section", { timeout: 5000 });

  const listCategory = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".menu-item-has-children")).map(
      (el) => el.innerText.trim()
    );
  });

  let allProducts = [];

  for (const category of listCategory) {
    let pageNumber = 1;
    console.log("Categoría seleccionada:", category);

    await page.goto(`https://www.challenger.com.co/${category}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector(".vitrine", { timeout: 10000 });

    const next = await page.evaluate(
      () =>
        Array.from(
          document.querySelectorAll(".pager.bottom .pages .page-number")
        ).length
    );
    console.log(`Páginas a rastrear de la categoría ${category} :`, next);
    console.log(`Extraer datos de la categoría ${category}`);

    while (pageNumber <= next) {
      await page.evaluate(
        () => new Promise((resolve) => setTimeout(resolve, 500))
      );

      const productsUrl = await page.evaluate(() => {
        return Array.from(document.querySelectorAll(".ag-card-grid ul li"))
          .map((item) => {
            return (
              item.querySelector(".ag-card__content")?.getAttribute("href") ||
              null
            );
          })
          .filter((url) => url !== null); // Filtra valores nulos
      });

      // Recorrer cada URL y navegar a la página correspondiente
      for (const url of productsUrl) {
        const fullUrl = url;
        await page.goto(fullUrl, { waitUntil: "domcontentloaded" });

        const element = await page.evaluate(() => {
          return {
            Categoria_challenger:
              document
                .querySelector(
                  ".ag-product-details__cod.codigo-produto .skuReference"
                )
                ?.innerText.trim() || "No disponible",
            Referencia_challenger1:
              document
                .querySelector(
                  ".ag-product-details__title.product-name .productName"
                )
                ?.innerText.trim() || "No disponible",
            Precio_Challenger: (
              document.querySelector(".skuBestPrice")?.innerHTML.trim() || "0"
            )
              .replace("$", "")
              .replace(/\./g, ""),
          };
        });

        allProducts = allProducts.concat(element);
      }

      // 🔹 Buscar el botón "Siguiente" en cada iteración
      const nextPageButton = await page.$(
        ".pager.bottom .btn-pager-bottom button"
      );

      if (!nextPageButton) {
        break;
      }

      try {
        await nextPageButton.click(); // Hacer clic en "Siguiente"
        await page.waitForNavigation({
          waitUntil: "domcontentloaded",
          timeout: 10000,
        }); // Esperar carga
        await page.waitForSelector(".ag-card-grid ul li", { timeout: 50000 }); // Asegurar que los productos cargaron
      } catch (error) {
        console.error(
          "\nError al hacer clic en 'Siguiente' o cargar la página:",
          error.message
        );
        break;
      }

      pageNumber++;
    }
  }

  await browser.close();
  let data = [];
  console.log("\n✅ Proceso completado.");
  console.log(`Total de productos extraídos: ${allProducts.length}`);
  let cont = 0;
  for (const product of allProducts) {
    if (product.Precio_Challenger !== "0") {
      actualizarProgreso((100 / allProducts.length) * (cont + 1));
      data.push(product);

      await axios.request({
        url: "https://zoho.accsolutions.tech/API/v1/Precios_Challenger",
        method: "post",
        data: product,
      });
      cont++;
    }
  }
  console.log("Finalizando ejecución...");
})();
