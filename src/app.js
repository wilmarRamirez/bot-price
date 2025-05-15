import { botChallenger } from '#server/challenger/bot';
import {botHaceb} from '#interface/haceb/bot'

(async() =>{
    
    await botChallenger()
        .then(() => {
            console.log("✅ Proceso de extracción de datos finalizado.");
        })
        .catch((error) => {
            console.error("❌ Error durante la extracción de datos:", error);
        }); 

    await botHaceb()
        .then(() => {
            console.log("✅ Proceso de extracción de datos finalizado.");
        })
        .catch((error) => {
            console.error("❌ Error durante la extracción de datos:", error);
        });
})()