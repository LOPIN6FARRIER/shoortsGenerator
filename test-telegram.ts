import "dotenv/config";

/**
 * Script para probar la configuración de Telegram
 * Ejecutar: npx tsx test-telegram.ts
 */

async function testTelegramNotifications() {
  console.log("🧪 Probando Notificaciones de Telegram...\n");

  // Verificar configuración
  const enabled = process.env.TELEGRAM_ENABLED === "true";
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  console.log(`📋 Configuración:`);
  console.log(`   TELEGRAM_ENABLED: ${enabled}`);
  console.log(`   TELEGRAM_BOT_TOKEN: ${token ? "✅ Configurado" : "❌ No configurado"}`);
  console.log(`   TELEGRAM_CHAT_ID: ${chatId || "❌ No configurado"}\n`);

  if (!enabled) {
    console.log("⚠️  Telegram está deshabilitado. Configura TELEGRAM_ENABLED=true en .env");
    return;
  }

  if (!token || !chatId) {
    console.log("❌ Falta configurar TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID");
    console.log("   Lee TELEGRAM_SETUP.md para instrucciones");
    return;
  }

  // Probar envío de mensaje
  try {
    console.log("📤 Enviando mensaje de prueba...");

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `✅ *Telegram Configurado Correctamente*

🎉 Tu bot está funcionando!
🤖 Bot: @${token.split(":")[0]}
👤 Chat ID: \`${chatId}\`

🕐 ${new Date().toLocaleString("es-ES")}`,
        parse_mode: "Markdown",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("❌ Error al enviar mensaje:");
      console.error(error);
      
      if (error.includes("Unauthorized")) {
        console.log("\n💡 Solución: Verifica que el TELEGRAM_BOT_TOKEN sea correcto");
      } else if (error.includes("chat not found")) {
        console.log("\n💡 Solución: Envía un mensaje a tu bot primero (busca tu bot y envía /start)");
      }
      return;
    }

    console.log("\n✅ ¡Mensaje enviado exitosamente!");
    console.log("   Revisa tu Telegram, deberías haber recibido un mensaje 📱\n");

    // Probar mensaje con formato
    console.log("📤 Enviando mensaje de prueba con formato...");
    
    const response2 = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `📊 *Mensaje de Prueba #2*

Este es un ejemplo de cómo se verán las notificaciones:

✅ Videos generados: 2
❌ Errores: 0
⏱️ Tiempo: 5m 30s

[Ver más detalles](https://github.com)`,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });

    if (response2.ok) {
      console.log("✅ Segundo mensaje enviado!\n");
      console.log("🎉 Todo funciona correctamente!");
      console.log("   Ahora recibirás notificaciones cuando se generen videos.\n");
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.log("\n💡 Verifica tu conexión a internet y la configuración");
  }
}

testTelegramNotifications();
