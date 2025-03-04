const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // Ir a la primera página de búsqueda en MercadoLibre
  await page.goto('https://listado.mercadolibre.com.co/laptops', { waitUntil: 'networkidle2' });

  let allProducts = []; // Guardará los datos de todos los productos

  while (true) {
    // Esperar a que carguen los productos
    await page.waitForSelector('.ui-search-layout__item');

    // Extraer nombres y precios de los productos
    const products = await page.evaluate(() => {
      const items = document.querySelectorAll('.ui-search-layout__item');
      return Array.from(items).map(item => {
        return {
          name: item.querySelector('.ui-search-item__title')?.innerText.trim() || 'Nombre no disponible',
          price: item.querySelector('.andes-money-amount__fraction')?.innerText.trim() || 'Precio no disponible',
          link: item.querySelector('.ui-search-link')?.href || 'Sin enlace'
        };
      });
    });

    // Agregar productos a la lista general
    allProducts = allProducts.concat(products);
    console.log(`Productos extraídos: ${products.length}`);

    // Verificar si hay botón de "Siguiente"
    const nextPageButton = await page.$('.andes-pagination__button--next a');

    if (nextPageButton) {
      // Hacer clic en el botón "Siguiente"
      await nextPageButton.click();
      await page.waitForTimeout(3000); // Esperar un poco para que la nueva página cargue
    } else {
      break; // Si no hay más páginas, salir del bucle
    }
  }

  console.log(`Total de productos extraídos: ${allProducts.length}`);
  console.log(allProducts);

  await browser.close();
})();
