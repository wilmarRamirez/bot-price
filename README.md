# 🛒 Bot Challenger – RPA para Extracción de Precios de E-commerce

Este proyecto es una RPA (Robotic Process Automation) desarrollada en Node.js que se encarga de **extraer precios de productos desde distintas plataformas de e-commerce**. El bot puede ejecutarse de forma manual o programada, y está diseñado para ser extensible, eficiente y fácil de mantener.

---

## 🚀 Funcionalidades

- 🔍 Extracción automatizada de precios desde sitios de e-commerce.
- 💾 Almacenamiento de los resultados en archivos JSON o en bases de datos.
- 🔄 Soporte para ejecución periódica (cron jobs).
- ⚠️ Manejo de errores y reintentos automáticos.
- 👁 Opción de uso de proxies, headers personalizados y simulación de navegación humana.

---

## 🧰 Tecnologías utilizadas

- **Node.js** – entorno de ejecución principal.
- **Axios / Cheerio / Puppeteer** – para solicitudes HTTP y/o scraping (dependiendo del sitio).
- **ESModules** (`import/export`) con soporte para alias.
- **dotenv** – para manejar configuraciones sensibles.
- **fs/promises** – para manipulación de archivos.

---

## 📁 Estructura del proyecto

```
bot-price/
├── src/
│   ├── app.js                     # Punto de entrada principal
│   ├── interface/
│   │   └── challenger/
│   │       └── bot.js             # Lógica principal del bot con interfaz
│   ├── server/
│   │   └── challenger/
│   │       └── bot.js             # Lógica principal del bot para ejecución en server
│   └── utils/
│       └── helpers.js             # Funciones auxiliares
├── data/
│   └── results.json               # Resultados de la extracción (ejemplo)
├── .env                           # Variables de entorno (opcional)
├── package.json
├── package-lok.json
└── README.md
```

---

## ⚙️ Instalación

1. Clona el repositorio:
   ```bash
   git clone git@github.com:wilmarRamirez/bot-price.git
   cd bot-price
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. (Opcional) Crea un archivo `.env` para definir configuraciones como URLs o claves API.

---

## ▶️ Ejecución

Para ejecutar el bot:

```bash
node src/app.js
```

---

## 📌 Ejemplo de uso

Archivo `src/app.js`:

```js
import { botChallenger } from '#server/challenger/bot';

(async () => {
  try {
    await botChallenger();
    console.log("✅ Proceso de extracción de datos finalizado.");
  } catch (error) {
    console.error("❌ Error durante la extracción de datos:", error);
  }
})();
```

---

## 🧪 Resultados

Los resultados se almacenan en:

```
/data/results.json
```

Ejemplo:

```json
[
  {
    "nombre": "Celular XYZ",
    "precio": "$1.200.000",
    "url": "https://www.ecommerce.com/producto/celular-xyz",
    "fecha": "2025-05-13T10:00:00Z"
  }
]
```

---

## 🛡 Consideraciones éticas y legales

- Este bot **no automatiza compras ni inicia sesión**: solo **lee información pública**.
- Asegúrate de respetar los términos de servicio de cada sitio web.
- Se recomienda utilizar `user-agent` personalizados y hacer pausas entre solicitudes para evitar bloqueos.

---

## 🤝 Contribuciones

¿Quieres mejorar el bot? ¡Bienvenido!

1. Haz un fork del proyecto.
2. Crea una rama: `git checkout -b nueva-funcionalidad`.
3. Haz tus cambios y sube: `git push origin nueva-funcionalidad`.
4. Abre un Pull Request 🚀.

También puedes abrir un `issue` para sugerencias, errores o nuevas ideas.

---

## 📄 Licencia

MIT © [Wilmar Ramírez](https://github.com/wilmarRamirez)
