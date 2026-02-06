# 🎬 Generador Automático de YouTube Shorts Bilingües

Sistema automatizado para crear y publicar YouTube Shorts de micro-documentales en **español** e **inglés** usando OpenAI GPT-4 y herramientas open-source.

## 🎯 Características

- ✅ Generación automática de guiones con OpenAI GPT-4
- ✅ Guiones únicos y dinámicos en español e inglés
- ✅ Conversión de texto a voz con Edge TTS (voces naturales)
- ✅ Videos verticales optimizados para Shorts (9:16)
- ✅ Subtítulos automáticos quemados en el video
- ✅ Publicación automática en dos canales de YouTube separados
- ✅ Ejecución programada con node-cron personalizable
- ✅ Logger profesional con Pino
- ✅ 100% ES Modules + TypeScript moderno

## 🚀 Despliegue en VPS

### 1. Requisitos del Sistema

```bash
# Node.js 20+ (requerido)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Python 3 (para Edge TTS)
sudo apt-get install -y python3 python3-pip

# FFmpeg (para video)
sudo apt-get install -y ffmpeg

# Edge TTS
pip3 install edge-tts
```

### 2. Clonar y Configurar Proyecto

```bash
# Clonar repositorio
cd /home/tu-usuario
git clone tu-repo.git videoGenerator
cd videoGenerator

# Instalar dependencias
npm install

# Copiar configuración
cp .env.example .env
```

### 3. Configurar Variables de Entorno

Editar `.env`:

```bash
nano .env
```

```env
# Modo de ejecución
NODE_ENV=production
LOG_LEVEL=info

# Cron Schedule
RUN_ONCE=false
CRON_SCHEDULE=0 10 * * *  # Diario a las 10:00 AM

# OpenAI (REQUERIDO)
OPENAI_API_KEY=sk-tu-api-key-aqui
OPENAI_MODEL=gpt-4

# YouTube Canal Español
ES_VOICE=es-MX-DaliaNeural
ES_YOUTUBE_CLIENT_ID=tu-client-id
ES_YOUTUBE_CLIENT_SECRET=tu-client-secret
ES_YOUTUBE_REDIRECT_URI=http://localhost:3000/oauth2callback
ES_YOUTUBE_CREDENTIALS_PATH=./credentials-es.json

# YouTube Canal Inglés
EN_VOICE=en-US-JennyNeural
EN_YOUTUBE_CLIENT_ID=tu-client-id
EN_YOUTUBE_CLIENT_SECRET=tu-client-secret
EN_YOUTUBE_REDIRECT_URI=http://localhost:3000/oauth2callback
EN_YOUTUBE_CREDENTIALS_PATH=./credentials-en.json
```

### 4. Autenticar YouTube (Una sola vez)

```bash
# Crear tunnel temporal para OAuth (desde tu PC local)
ssh -L 3000:localhost:3000 usuario@tu-vps-ip

# En el VPS, ejecutar auth
npm run auth

# Seguir las instrucciones en el navegador
# Se guardarán credentials-es.json y credentials-en.json
```

### 5. Compilar Proyecto

```bash
npm run build
```

### 6. Opciones de Ejecución

#### A. Con PM2 (Recomendado)

```bash
# Instalar PM2
npm install -g pm2

# Iniciar aplicación
pm2 start dist/index.js --name youtube-shorts

# Ver logs
pm2 logs youtube-shorts

# Ver status
pm2 status

# Restart
pm2 restart youtube-shorts

# Stop
pm2 stop youtube-shorts

# Auto-start en boot
pm2 startup
pm2 save
```

#### B. Con systemd

Crear `/etc/systemd/system/youtube-shorts.service`:

```ini
[Unit]
Description=YouTube Shorts Generator
After=network.target

[Service]
Type=simple
User=tu-usuario
WorkingDirectory=/home/tu-usuario/videoGenerator
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /home/tu-usuario/videoGenerator/dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Activar servicio:

```bash
sudo systemctl daemon-reload
sudo systemctl enable youtube-shorts
sudo systemctl start youtube-shorts
sudo systemctl status youtube-shorts

# Ver logs
sudo journalctl -u youtube-shorts -f
```

#### C. Ejecución Manual (Testing)

```bash
# Una sola vez
RUN_ONCE=true node dist/index.js

# Modo cron (programado)
node dist/index.js
```

### 7. Personalizar Schedule de Cron

Editar `.env`:

```env
# Ejemplos:
CRON_SCHEDULE=0 10 * * *       # Diario 10:00 AM
CRON_SCHEDULE=0 */6 * * *      # Cada 6 horas
CRON_SCHEDULE=0 8,20 * * *     # 8:00 AM y 8:00 PM
CRON_SCHEDULE=0 0 * * 0        # Domingos medianoche
CRON_SCHEDULE=*/30 * * * *     # Cada 30 minutos
```

### 8. Monitoreo y Logs

```bash
# Con PM2
pm2 logs youtube-shorts --lines 100

# Con systemd
sudo journalctl -u youtube-shorts -f

# Logs del proyecto (si LOG_LEVEL=debug)
tail -f output/logs/app.log
```

### 9. Actualizar Proyecto

```bash
cd /home/tu-usuario/videoGenerator
git pull
npm install
npm run build
pm2 restart youtube-shorts  # O sudo systemctl restart youtube-shorts
```

### 10. Seguridad

```bash
# Proteger archivos sensibles
chmod 600 .env
chmod 600 credentials-*.json

# Configurar firewall (opcional)
sudo ufw allow 22/tcp  # SSH
sudo ufw enable

# No exponer puertos innecesarios
# La app NO necesita puertos abiertos (solo salida para APIs)
```

## 📋 Comandos Disponibles

```bash
# Desarrollo local
npm run dev          # Ejecutar en modo desarrollo (tsx)
npm run build        # Compilar TypeScript
npm start            # Ejecutar compilado (node-cron activo)

# Configuración
npm run auth         # Configurar OAuth2 YouTube
npm run check        # Verificar dependencias del sistema

# Testing
RUN_ONCE=true npm run dev   # Ejecutar una sola vez
```

## 🔧 Troubleshooting VPS

### Error: "OPENAI_API_KEY no configurada"
```bash
# Verificar .env existe
cat .env | grep OPENAI_API_KEY

# Debe mostrar: OPENAI_API_KEY=sk-xxxxx
```

### Error: "edge-tts not found"
```bash
# Instalar Edge TTS
pip3 install edge-tts

# Verificar instalación
edge-tts --version
```

### Error: "ffmpeg not found"
```bash
# Instalar FFmpeg
sudo apt-get update
sudo apt-get install -y ffmpeg

# Verificar
ffmpeg -version
```

### PM2 no inicia correctamente
```bash
# Ver logs de error
pm2 logs youtube-shorts --err --lines 50

# Verificar compilación
npm run build

# Reiniciar desde cero
pm2 delete youtube-shorts
pm2 start dist/index.js --name youtube-shorts
```

### Videos no se suben a YouTube
```bash
# Verificar credenciales
ls -la credentials-*.json

# Re-autenticar si es necesario
npm run auth

# Verificar permisos
chmod 600 credentials-*.json
```

## 📊 Estructura del Proyecto

```
videoGenerator/
├── src/
│   ├── index.ts          # Entry point + node-cron
│   ├── pipeline.ts       # Pipeline de generación
│   ├── config.ts         # Configuración
│   ├── script.ts         # OpenAI script generation
│   ├── tts.ts           # Edge TTS
│   ├── video.ts         # FFmpeg video generation
│   ├── subtitles.ts     # SRT generation
│   ├── upload.ts        # YouTube upload
│   ├── topic.ts         # Topic generation
│   └── utils.ts         # Logger (Pino) + utils
├── dist/                # JavaScript compilado
├── output/              # Videos generados
│   ├── es/             # Canal español
│   └── en/             # Canal inglés
├── .env                 # Variables de entorno
├── credentials-*.json   # OAuth2 tokens
└── package.json
```

## 🔑 Variables de Entorno Importantes

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `RUN_ONCE` | Ejecutar una sola vez | `true` o `false` |
| `CRON_SCHEDULE` | Programación cron | `0 10 * * *` |
| `NODE_ENV` | Entorno | `production` |
| `LOG_LEVEL` | Nivel de logs | `info` o `debug` |
| `OPENAI_API_KEY` | API Key de OpenAI | `sk-xxxxx` |
| `OPENAI_MODEL` | Modelo de OpenAI | `gpt-4` |

## 📝 Requisitos Previos

### Software Requerido

1. **Node.js** (v20 o superior)
   ```bash
   node --version
   ```

2. **Python 3** (para Edge TTS)
   ```bash
   python3 --version
   ```

3. **FFmpeg** (para procesamiento de video)
   ```bash
   ffmpeg -version
   ```

4. **edge-tts** (Text-to-Speech de Microsoft)
   ```bash
   pip3 install edge-tts
   ```

### Instalación de Dependencias del Sistema

**Ubuntu/Debian VPS:**
```bash
# Todo en uno
sudo apt-get update && \
sudo apt-get install -y nodejs npm python3 python3-pip ffmpeg && \
pip3 install edge-tts
```

**Windows (desarrollo local):**
```powershell
# Instalar Python desde python.org
# Instalar FFmpeg desde ffmpeg.org o con Chocolatey:
choco install ffmpeg

# Instalar edge-tts
pip install edge-tts
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install -y python3 python3-pip ffmpeg
pip3 install edge-tts
```

**macOS:**
```bash
brew install python ffmpeg
pip3 install edge-tts
```

## 🚀 Instalación

1. **Clonar o crear el proyecto:**
   ```bash
   git clone <tu-repositorio>
   cd videoGenerator
   ```

2. **Instalar dependencias de Node.js:**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno:**
   ```bash
   cp .env.example .env
   ```

4. **Editar `.env` con tus configuraciones:**
   ```env
   # Voces Edge TTS (ver lista abajo)
   ES_VOICE=es-MX-DaliaNeural
   EN_VOICE=en-US-JennyNeural

   # Credenciales YouTube API Canal Español
   ES_YOUTUBE_CLIENT_ID=tu_client_id
   ES_YOUTUBE_CLIENT_SECRET=tu_client_secret
   ES_YOUTUBE_CREDENTIALS_PATH=./credentials-es.json

   # Credenciales YouTube API Canal Inglés
   EN_YOUTUBE_CLIENT_ID=tu_client_id
   EN_YOUTUBE_CLIENT_SECRET=tu_client_secret
   EN_YOUTUBE_CREDENTIALS_PATH=./credentials-en.json
   ```

## 🔑 Configuración de YouTube API

### Paso 1: Crear Proyectos en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea **dos proyectos separados** (uno por canal):
   - Proyecto 1: "YouTube Channel ES"
   - Proyecto 2: "YouTube Channel EN"

### Paso 2: Habilitar YouTube Data API v3

Para cada proyecto:
1. Ve a **"APIs & Services" > "Library"**
2. Busca **"YouTube Data API v3"**
3. Haz clic en **"Enable"**

### Paso 3: Crear Credenciales OAuth 2.0

Para cada proyecto:
1. Ve a **"APIs & Services" > "Credentials"**
2. Clic en **"Create Credentials" > "OAuth client ID"**
3. Selecciona **"Desktop app"**
4. Copia el **Client ID** y **Client Secret**
5. Pégalos en tu archivo `.env`

### Paso 4: Autenticar las Aplicaciones

Crea un script temporal `auth.ts`:

```typescript
import { CONFIG } from './src/config';
import { generateAuthUrl } from './src/upload';

console.log('=== AUTENTICACIÓN CANAL ESPAÑOL ===');
const esUrl = generateAuthUrl(CONFIG.channels.es);
console.log('\nVisita esta URL y autoriza:\n', esUrl);

console.log('\n=== AUTENTICACIÓN CANAL INGLÉS ===');
const enUrl = generateAuthUrl(CONFIG.channels.en);
console.log('\nVisita esta URL y autoriza:\n', enUrl);
```

Ejecuta:
```bash
ts-node auth.ts
```

1. Visita cada URL en tu navegador
2. Autoriza la aplicación
3. Copia el código de autorización de la URL
4. Usa ese código para generar `credentials-es.json` y `credentials-en.json`

## 🎤 Voces Disponibles (Edge TTS)

### Español
- `es-MX-DaliaNeural` - México, femenina
- `es-MX-JorgeNeural` - México, masculina
- `es-ES-ElviraNeural` - España, femenina
- `es-ES-AlvaroNeural` - España, masculina
- `es-AR-ElenaNeural` - Argentina, femenina
- `es-CO-SalomeNeural` - Colombia, femenina

### Inglés
- `en-US-JennyNeural` - USA, femenina
- `en-US-GuyNeural` - USA, masculina
- `en-GB-SoniaNeural` - UK, femenina
- `en-GB-RyanNeural` - UK, masculina
- `en-AU-NatashaNeural` - Australia, femenina

**Listar todas las voces disponibles:**
```bash
edge-tts --list-voices
```

## ▶️ Uso

### Ejecución Manual

Generar y subir Shorts en ambos idiomas:
```bash
npm start
```

### Modo Desarrollo (sin compilar)
```bash
npm run dev
```

### Compilar sin ejecutar
```bash
npm run build
```

## ⏰ Automatización con Cron (VPS Linux)

### Configurar Cron Job

1. Edita el crontab:
   ```bash
   crontab -e
   ```

2. Agrega una línea para ejecutar diariamente a las 10:00 AM:
   ```cron
   0 10 * * * cd /ruta/a/videoGenerator && /usr/bin/npm start >> /var/log/shorts-generator.log 2>&1
   ```

3. Ejecutar cada 6 horas:
   ```cron
   0 */6 * * * cd /ruta/a/videoGenerator && /usr/bin/npm start >> /var/log/shorts-generator.log 2>&1
   ```

### Verificar Logs
```bash
tail -f /var/log/shorts-generator.log
```

## 📁 Estructura del Proyecto

```
videoGenerator/
├── src/
│   ├── config.ts          # Configuración general
│   ├── utils.ts           # Utilidades y logger
│   ├── topic.ts           # Generación de temas
│   ├── script.ts          # Generación de guiones
│   ├── tts.ts             # Text-to-Speech (Edge TTS)
│   ├── subtitles.ts       # Generación de SRT
│   ├── video.ts           # Generación de videos (FFmpeg)
│   ├── upload.ts          # Subida a YouTube
│   └── index.ts           # Orquestador principal
├── output/
│   ├── es/                # Videos en español
│   └── en/                # Videos en inglés
├── assets/                # Recursos opcionales
├── package.json
├── tsconfig.json
├── .env                   # Variables de entorno
└── README.md
```

## 🎨 Personalización

### Agregar Nuevos Temas

Edita `src/topic.ts` y añade al array `TOPICS`:

```typescript
{
  id: 'nuevo-tema',
  title: 'Título del Tema',
  description: 'Descripción breve'
}
```

### Agregar Guiones para Nuevos Temas

Edita `src/script.ts` y añade al objeto `SCRIPTS`:

```typescript
'nuevo-tema': {
  es: {
    title: 'Título en Español',
    narrative: 'Narrativa completa del guion...',
    description: 'Descripción para YouTube',
    tags: ['tag1', 'tag2']
  },
  en: {
    title: 'Title in English',
    narrative: 'Full narrative script...',
    description: 'YouTube description',
    tags: ['tag1', 'tag2']
  }
}
```

### Cambiar Estilo de Subtítulos

Edita `src/video.ts`, línea del filtro `subtitles`:

```typescript
FontName=Arial Bold,
FontSize=28,
PrimaryColour=&HFFFFFF,
OutlineColour=&H000000,
Outline=3,
Shadow=2,
Alignment=2,     // 2=bottom center
MarginV=200      // Margen desde el borde
```

### Usar Imágenes/Videos de Fondo

1. Coloca tus medias en `assets/images/` o `assets/videos/`
2. Usa la función `generateVideoWithMedia()` en lugar de `generateVideo()`

## 🐛 Solución de Problemas

### Error: "edge-tts no encontrado"
```bash
pip install --upgrade edge-tts
# o con pip3
pip3 install --upgrade edge-tts
```

### Error: "FFmpeg no encontrado"
Verifica que FFmpeg esté en el PATH:
```bash
ffmpeg -version
```

### Error: "Credenciales de YouTube inválidas"
1. Verifica que los archivos `credentials-*.json` existan
2. Reautentica siguiendo el proceso del **Paso 4** de configuración
3. Verifica que los Client ID y Secret sean correctos

### Error: "Cuota de YouTube API excedida"
- Cada proyecto tiene un límite diario de subidas
- Espera 24 horas o crea proyectos adicionales
- Usa `privacyStatus: 'unlisted'` en `src/upload.ts` para ahorrar cuota

### Videos muy largos (>60 segundos)
- Edita los guiones en `src/script.ts` para hacerlos más cortos
- Ajusta la velocidad de la voz en `src/tts.ts` (si Edge TTS lo soporta)
- Reduce el número de palabras por segmento en `src/subtitles.ts`

## 📊 Limitaciones Actuales

- **Temas**: Predefinidos en código (15 temas disponibles)
- **Guiones**: Escritos manualmente por tema
- **Visuales**: Fondo con gradiente (no usa imágenes stock automáticas)
- **Cuota YouTube**: Limitada por la API (6 uploads/día por proyecto)

## 🚀 Mejoras Futuras

- [ ] Integración con OpenAI GPT para generar guiones dinámicos
- [ ] Descarga automática de imágenes/videos stock (Pexels, Unsplash)
- [ ] Soporte para más idiomas (francés, alemán, portugués)
- [ ] Dashboard web para monitoreo
- [ ] Base de datos para historial de videos
- [ ] Análisis de métricas de YouTube
- [ ] Generación de thumbnails personalizados

## 📄 Licencia

MIT License - Libre para uso personal y comercial.

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:
1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📧 Soporte

Para preguntas o problemas:
- Abre un issue en GitHub
- Revisa la documentación de [YouTube Data API](https://developers.google.com/youtube/v3)
- Consulta la documentación de [Edge TTS](https://github.com/rany2/edge-tts)

---

**Hecho con ❤️ para automatizar la creación de contenido educativo**
