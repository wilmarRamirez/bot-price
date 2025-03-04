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
    args: [`--window-size=1880,980`], // Establece el tamaño de la ventana
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1880, height: 980 }); // Ajusta el viewport
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
    let currentPageNumber = 1; // Iniciar con la primera página
    // while (pageNumber <= next) {
    while (true) {
      await page.evaluate(
        () => new Promise((resolve) => setTimeout(resolve, 500))
      );

      const productsUrl = await page.evaluate(() => {
        return Array.from(
          document.querySelectorAll(".ag-card-grid ul li a.ag-card__content")
        ).map((item) => item.href); // Captura todas las URLs de los productos
      });

      for (const url of productsUrl) {
        await page.goto(url, { waitUntil: "domcontentloaded" }); // Ir a la página del producto
        await page.evaluate(
          () => new Promise((resolve) => setTimeout(resolve, 500))
        );
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
        await page.goBack(); // Regresar a la página de la lista
      }

      // 🔹 Buscar el botón "Siguiente" en cada iteración
      const nextPageButton = await page.$(".pager.bottom li.next");

      if (!nextPageButton) {
        break;
      }

      try {
        // Obtener la página actual y verificar si existe una siguiente
        const { nextPageExists, nextPageNumber } = await page.evaluate(() => {
          const currentPage = document.querySelector(".page-number.pgCurrent");
          const nextButton = currentPage?.nextElementSibling; // Siguiente página

          return {
            nextPageExists: !!nextButton, // ¿Existe la siguiente página?
            nextPageNumber: nextButton
              ? parseInt(nextButton.innerText.trim())
              : null,
          };
        });

        // Si no hay más páginas, salir del bucle
        if (!nextPageExists) {
          console.log("✅ No hay más páginas. Finalizando...");
          break;
        }

        console.log(`➡️ Avanzando a la página ${nextPageNumber}...`);
        if (nextPageNumber === null) break;

        // Hacer clic en la siguiente página
        await page.click(".page-number.pgCurrent + li");

        // Esperar que el cambio de página se refleje asegurando que la clase `pgCurrent` cambie
        await page.waitForFunction(
          (prevPage) => {
            const newPage = document.querySelector(".page-number.pgCurrent");
            return newPage && parseInt(newPage.innerText.trim()) !== prevPage;
          },
          {}, // Opciones
          currentPageNumber // Pasar el número de la página actual antes del cambio
        );

        // Actualizar el número de página actual
        currentPageNumber = nextPageNumber;

        // Esperar que los productos carguen antes de continuar
        await page.waitForSelector(".ag-card-grid.n12colunas ul li", {
          timeout: 50000,
        });
      } catch (error) {
        console.error(
          "❌ Error al hacer clic en 'Siguiente' o cargar la página:",
          error.message
        );
        break; // Terminar si hay un error
      }
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
