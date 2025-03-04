import axios from "axios";
import puppeteer from "puppeteer";
import readline from "readline";

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (respuesta) => {
      rl.close();
      resolve(respuesta);
    });
  });
}

function actualizarProgreso(progreso) {
  readline.cursorTo(process.stdout, 0);
  process.stdout.write(`Cargando: ${progreso.toFixed(2)}%\r`);
}

(async () => {
  const categoria = await askQuestion("Ingresa la categoría a rastrear: ");
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto(`https://www.challenger.com.co/${categoria}`, {
    waitUntil: "domcontentloaded",
  });

  let allProducts = [];
  let pageNumber = 1;
  await page.waitForSelector(".vitrine", { timeout: 10000 });

  const next = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".pager.bottom .pages .page-number"))
  );

  console.log('Categoría seleccionada:', categoria);
  console.log('Páginas a rastrear:', next.length);
  console.log('Extraer datos')

  while (pageNumber < next.length + 1) {
    await page.evaluate(
      () => new Promise((resolve) => setTimeout(resolve, 500))
    );
    actualizarProgreso((100 / next.length) * pageNumber);

    const products = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(".ag-card-grid ul li")).map(
        (item) => ({
          Referencia_challenger1:
            item.querySelector("a .ag-card__title")?.innerText.trim() || "0",
          Categoria_challenger: (item.querySelector("img")?.alt || "Sin_alt")
            .split("_")[0]
            .replace("-", ""),
          Precio_Challenger: (
            item.querySelector(".ag-card__price_best")?.innerText.trim() || "0"
          )
            .replace("$", "")
            .replace(/\./g, ""),
        })
      );
    });

    allProducts = allProducts.concat(products);

    await page.waitForSelector(".pager.bottom .btn-pager-bottom button", {
      visible: true,
      timeout: 6000,
    });

    const nextPageButton = await page.$(
      ".pager.bottom .btn-pager-bottom button"
    );

    if (!nextPageButton) {
      console.log("\nNo se encontró el botón 'Siguiente'. Fin del scraping.");
      break;
    }

    await nextPageButton.click();
    pageNumber++;
  }

  await browser.close();
  let data = [];

  console.log('')
  console.log('Crear registros')
  for (let key = 0; key < allProducts.length; key++) {
    if (
      allProducts[key].Referencia_challenger1 !== "0" &&
      allProducts[key].Precio_Challenger !== "0"
    ) {
      actualizarProgreso((100 / allProducts.length) * (key + 1));
      data.push(allProducts[key]);

      await axios.request({
        url: "https://zoho.accsolutions.tech/API/v1/Precios_Challenger",
        method: "post",
        data: allProducts[key],
      });
    }
  }
  actualizarProgreso(100)
  console.log('\n✅ Proceso completado.');
  console.log(`Total de productos extraídos: ${allProducts.length}`);
})();
