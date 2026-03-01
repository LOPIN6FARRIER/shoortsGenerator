# 📱 Configuración de Notificaciones Telegram

## 🎯 ¿Qué recibirás?

Las notificaciones de Telegram te alertarán sobre:

- ✅ **Videos generados exitosamente** (con link a YouTube)
- ❌ **Errores en uploads** (con detalles del problema)
- 🔑 **Canales que necesitan re-autenticación**
- 📊 **Inicio/completación del pipeline**
- ⚠️ **Cuota de YouTube excedida**

---

## 🚀 Configuración Rápida (5 minutos)

### **Paso 1: Crear tu Bot de Telegram**

1. **Abrir Telegram** en tu teléfono o computadora

2. **Buscar**: `@BotFather`

3. **Enviar**: `/newbot`

4. **Nombrar tu bot**:
   ```
   Nombre: Video Generator Bot
   Username: mi_videogenerator_bot
   ```

5. **BotFather te responderá con un token**, algo como:
   ```
   123456789:ABCdefGHIjklMNOpqrsTUVwxyz
   ```
   ⚠️ **COPIA ESTE TOKEN** - lo necesitarás en el `.env`

---

### **Paso 2: Obtener tu Chat ID**

**Opción A: Usando @userinfobot (Más fácil)**

1. Buscar en Telegram: `@userinfobot`
2. Enviarle: `/start`
3. Te responderá con tu ID: `1234567890`
4. **COPIA ESTE NÚMERO**

**Opción B: Manualmente**

1. Envía un mensaje a tu bot (el que creaste con BotFather)
2. Abre en navegador:
   ```
   https://api.telegram.org/bot<TU_TOKEN>/getUpdates
   ```
   (Reemplaza `<TU_TOKEN>` con el token del Paso 1)
3. Busca en la respuesta JSON:
   ```json
   "chat":{"id":1234567890}
   ```
4. **COPIA ESE NÚMERO**

---

### **Paso 3: Configurar Variables de Entorno**

Edita tu archivo `.env`:

```bash
# Telegram Notifications
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=1234567890
```

**Reemplaza con tus valores:**
- `TELEGRAM_BOT_TOKEN`: El token que te dio BotFather
- `TELEGRAM_CHAT_ID`: Tu ID de usuario

---

### **Paso 4: Probar la Configuración**

**Opción 1: Via Node.js**

Crea un archivo `test-telegram.ts`:

```typescript
import "dotenv/config";

async function testTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "✅ Telegram configurado correctamente!",
    }),
  });

  if (response.ok) {
    console.log("✅ Mensaje enviado! Revisa tu Telegram");
  } else {
    console.error("❌ Error:", await response.text());
  }
}

testTelegram();
```

Ejecutar:
```bash
npx tsx test-telegram.ts
```

**Opción 2: Via cURL**

```bash
curl -X POST "https://api.telegram.org/bot<TU_TOKEN>/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "<TU_CHAT_ID>",
    "text": "✅ Telegram configurado correctamente!"
  }'
```

Si todo funciona, recibirás un mensaje en Telegram ✅

---

## 📋 Ejemplos de Notificaciones

### **Video Generado Exitosamente**
```
✅ Video Generado Exitosamente

📺 Canal: Shorts ES (ES)
🎬 Título: The Invisible Art of Parking Lot Stripes
🔗 Link: https://youtube.com/watch?v=abc123

🕐 1/3/2026 10:30:45
```

### **Error en Upload**
```
❌ Error en Video

📺 Canal: Shorts EN (EN)
🎬 Título: The Secret Life of Traffic Lights
⚠️ Error: Token expired and could not refresh...

🕐 1/3/2026 10:30:45
```

### **Re-Autenticación Requerida**
```
🔑 Re-Autenticación Requerida

📺 Canal: Shorts ES
🆔 ID: 79067c08-a9e1-467b-a162-b65e1c15d0b9

⚠️ Los tokens de YouTube expiraron o son inválidos.

Acción necesaria:
1. Ir al dashboard
2. Re-autenticar el canal
```

### **Pipeline Completado**
```
✅ Pipeline Completado

📹 Videos generados: 2
⏱️ Tiempo: 5m 30s

🕐 1/3/2026 10:35:15
```

---

## 🔧 Solución de Problemas

### **"Unauthorized" o "Bot token invalid"**
- Verifica que copiaste bien el token de BotFather
- El token debe incluir el número y todo después de los `:`

### **"Chat not found"**
- Verifica que el Chat ID sea correcto
- **IMPORTANTE**: Debes enviar al menos un mensaje a tu bot antes de que funcione
- Busca tu bot en Telegram y envíale `/start`

### **No recibes notificaciones**
1. Verifica que `TELEGRAM_ENABLED=true`
2. Revisa los logs del sistema: debería decir "Telegram notification sent successfully"
3. Verifica que el bot no esté bloqueado en tu Telegram

### **"Too Many Requests"**
- Telegram tiene límite: 30 mensajes/segundo
- El sistema no debería alcanzar este límite en uso normal

---

## 🔒 Seguridad

⚠️ **NUNCA compartas tu Bot Token** - cualquiera con el token puede enviar mensajes como tu bot

**Buenas prácticas:**
- Mantén el `.env` en `.gitignore`
- Si el token se filtra, revócalo en BotFather con `/revoke`
- Usa variables de entorno en producción (no hardcodear el token)

---

## 📱 Notificaciones en Grupos (Opcional)

Si quieres recibir notificaciones en un grupo de Telegram:

1. Crear un grupo en Telegram
2. Agregar tu bot al grupo
3. Hacerlo admin (necesario para enviar mensajes)
4. Obtener el Group Chat ID:
   - Envía un mensaje al grupo
   - Visita: `https://api.telegram.org/bot<TU_TOKEN>/getUpdates`
   - Busca `"chat":{"id":-1001234567890}` (nota el signo negativo)
5. Usar ese ID negativo como `TELEGRAM_CHAT_ID`

---

## 💡 Tips

**Múltiples destinatarios**: Si quieres enviar a varias personas/grupos, puedes:
- Crear múltiples bots (uno por destino)
- O modificar `notifications.ts` para enviar a múltiples chat IDs

**Formato de mensajes**: Telegram soporta Markdown para texto enriquecido:
- `*texto*` = **negrita**
- `_texto_` = _cursiva_
- `` `código` `` = `código`
- `[link](url)` = [link](url)

---

## 🆘 Ayuda

Si tienes problemas:
1. Revisa los logs: `pm2 logs` o `node dist/index.js`
2. Verifica que el bot exista en Telegram
3. Verifica las variables de entorno: `echo $TELEGRAM_BOT_TOKEN`
4. Prueba enviar un mensaje manualmente con cURL

---

## 📖 Recursos

- [Telegram Bot API Docs](https://core.telegram.org/bots/api)
- [BotFather Commands](https://core.telegram.org/bots#6-botfather)
- [Telegram Bot Features](https://core.telegram.org/bots/features)
