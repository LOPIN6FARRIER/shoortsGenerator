# 🔑 Guía de Re-Autenticación de Canales YouTube

## ¿Por qué necesito re-autenticar?

Los tokens de YouTube pueden volverse inválidos por:
- **Revocación manual**: Usuario revocó permisos en Google Account
- **Expiración**: Tokens de apps en modo "Testing" expiran en 7 días
- **Cambios de scopes**: Se modificaron los permisos requeridos
- **Error `invalid_grant`**: Refresh token ya no es válido

## ✅ Solución Automática

El sistema ahora **detecta y limpia automáticamente** tokens inválidos cuando ocurre un error `invalid_grant`. Los canales afectados quedarán marcados como "requieren re-autenticación".

---

## 🔍 Verificar Estado de Autenticación

### Opción 1: API Endpoint (todos los canales)
```bash
curl http://localhost:3000/api/youtube-auth/channels-status
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Channels auth status retrieved",
  "data": {
    "channels": [
      {
        "id": "79067c08-a9e1-467b-a162-b65e1c15d0b9",
        "name": "Shorts ES",
        "language": "es",
        "isAuthenticated": false,
        "tokenExpiry": null,
        "needsReauth": true  // ⚠️ NECESITA RE-AUTENTICACIÓN
      },
      {
        "id": "abc123...",
        "name": "Shorts EN",
        "language": "en",
        "isAuthenticated": true,
        "tokenExpiry": 1709309842000,
        "needsReauth": false  // ✅ OK
      }
    ]
  }
}
```

### Opción 2: API Endpoint (canal individual)
```bash
curl http://localhost:3000/api/youtube-auth/79067c08-a9e1-467b-a162-b65e1c15d0b9/status
```

---

## 🔧 Cómo Re-Autenticar un Canal

### **Método 1: Via Dashboard (Recomendado)**

1. Ir al dashboard: `http://tu-vps-ip:3000` o `http://localhost:4200`
2. Sección **Channels**
3. Buscar el canal con ⚠️ "Needs Reauth"
4. Click en **"Re-authenticate"**
5. Seguir flujo OAuth en Google

---

### **Método 2: Via API (Manual)**

#### **Paso 1: Obtener URL de autenticación**

```bash
curl http://localhost:3000/api/youtube-auth/79067c08-a9e1-467b-a162-b65e1c15d0b9/auth-url
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...",
    "state": "eyJjaGFubmVsSWQiOiI3OTA2N2MwOC1hOWUxLTQ2N2ItYTE2Mi1iNjVlMWMxNWQwYjkiLCJ0aW1lc3RhbXAiOjE3MDkzMDk4NDIwMDB9"
  }
}
```

#### **Paso 2: Abrir URL en navegador**

1. Copiar la `authUrl` de la respuesta
2. Abrirla en navegador
3. Iniciar sesión con la cuenta de YouTube del canal
4. Aceptar permisos

#### **Paso 3: Obtener código de autorización**

Después de aceptar permisos, Google te redirige a:
```
http://localhost:3000/api/youtube-auth/callback?code=4/0AeaYS...&state=eyJjaGF...
```

**COPIA EL CÓDIGO** (el valor después de `code=` y antes de `&state`)

#### **Paso 4: Enviar código manualmente**

```bash
curl -X POST http://localhost:3000/api/youtube-auth/79067c08-a9e1-467b-a162-b65e1c15d0b9/manual-code \
  -H "Content-Type: application/json" \
  -d '{
    "code": "4/0AeaYSHB7_EL9..."
  }'
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "message": "YouTube authentication successful",
  "data": {
    "success": true
  }
}
```

---

## 📋 Checklist Post Re-Autenticación

✅ Verificar que `needsReauth: false` en `/channels-status`  
✅ Token expiry debe tener fecha futura  
✅ Siguiente ejecución del pipeline debe funcionar sin errores  

---

## 🛡️ Prevenir Tokens Inválidos

### **1. App en Producción (recomendado)**

Si tu app de Google Cloud Console está en **modo Testing**:
- Los tokens expiran en **7 días**
- Tendrás que re-autenticar semanalmente

**Solución**: Publicar la app como "In Production"

1. Ir a [Google Cloud Console](https://console.cloud.google.com)
2. APIs & Services > OAuth consent screen
3. Click **"PUBLISH APP"**
4. Los tokens durarán **6 meses** (renovados automáticamente)

### **2. Refresh Automático**

El sistema ya tiene refresh automático que:
- Detecta tokens por expirar (24h antes)
- Refresca automáticamente
- Actualiza tokens en BD
- Solo requiere re-auth manual si el refresh falla

---

## ❓ Troubleshooting

### "Channel not found"
El `channelId` no existe en BD. Verifica con `/channels-status`.

### "Channel OAuth configuration incomplete"
El canal no tiene `youtube_client_id`, `youtube_client_secret` o `youtube_redirect_uri` configurados.

### "invalid_grant" persiste
1. Verificar que la app de Google Cloud Console esté activa
2. Verificar que los scopes sean correctos: `https://www.googleapis.com/auth/youtube.upload`
3. Probar revocar y re-autenticar desde cero usando el endpoint DELETE:
   ```bash
   curl -X DELETE http://localhost:3000/api/youtube-auth/79067c08-a9e1-467b-a162-b65e1c15d0b9
   ```

---

## 📞 Soporte

Si los problemas persisten:
1. Revisar logs del sistema: `pm2 logs` o logs del servidor
2. Verificar credenciales en `google.json`
3. Revisar configuración de OAuth en Google Cloud Console
