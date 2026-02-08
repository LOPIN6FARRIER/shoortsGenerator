# Sistema de Autenticación - Guía de Implementación

## 📋 Descripción

Se ha implementado un sistema completo de autenticación para el dashboard con las siguientes características:

### ✨ Características

- **Autenticación JWT**: Tokens seguros con expiración
- **Refresh Tokens**: Sesiones de larga duración (30 días)
- **Roles de Usuario**: Admin, Editor, Viewer
- **Audit Log**: Registro de todos los eventos de autenticación
- **Middleware**: Protección de rutas en el backend
- **Guards**: Protección de rutas en el frontend
- **Interceptores**: Manejo automático de tokens y errores

## 🗄️ Base de Datos

### Aplicar Migración

1. **Conectar a PostgreSQL**:
```bash
psql -U postgres
```

2. **Conectar a la base de datos**:
```sql
\c youtube_shorts_db
```

3. **Ejecutar la migración**:
```sql
\i database/migrations/010_add_authentication_system.sql
```

### Tablas Creadas

- **users**: Usuarios del sistema
- **sessions**: Sesiones activas
- **refresh_tokens**: Tokens de refresco
- **auth_audit_log**: Registro de auditoría

### Usuario por Defecto

```
Email: admin@videogenerator.com
Password: admin123
```

⚠️ **IMPORTANTE**: Cambia esta contraseña en producción

## 🔐 Configuración

### Backend (.env)

Agrega estas variables a tu archivo `.env`:

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h

# API Configuration
API_PORT=3435
```

### Frontend (environment.ts)

Ya configurado:
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3435/api',
};
```

## 🚀 Uso

### Backend - Rutas Protegidas

Todas las rutas excepto `/api/health` y `/api/auth/*` requieren autenticación.

**Ejemplo de uso del middleware**:
```typescript
// Ya aplicado en routes.ts
router.use("/channels", authMiddleware, channelsRouter);
router.use("/videos", authMiddleware, videosRouter);
```

**Protección por roles**:
```typescript
import { requireRole } from "../middleware/auth.middleware.js";

// Solo administradores
router.post("/users", authMiddleware, requireRole("admin"), createUserHandler);

// Administradores y editores
router.put("/videos/:id", authMiddleware, requireRole("admin", "editor"), updateVideoHandler);
```

### Frontend - Rutas Protegidas

```typescript
// En app.routes.ts
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { 
    path: 'dashboard', 
    component: DashboardComponent,
    canActivate: [authGuard]  // Proteger ruta
  },
  // ...
];
```

## 📡 API Endpoints

### Autenticación

#### POST /api/auth/login
Login de usuario
```json
Request:
{
  "email": "admin@videogenerator.com",
  "password": "admin123"
}

Response:
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "admin@videogenerator.com",
    "name": "Admin User",
    "role": "admin"
  },
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### POST /api/auth/logout
Cerrar sesión (requiere autenticación)
```json
Headers:
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### POST /api/auth/refresh
Refrescar token de acceso
```json
Request:
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}

Response:
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { ... }
}
```

#### GET /api/auth/me
Obtener usuario actual (requiere autenticación)
```json
Headers:
Authorization: Bearer <token>

Response:
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "admin@videogenerator.com",
    "name": "Admin User",
    "role": "admin"
  }
}
```

#### POST /api/auth/register
Registrar nuevo usuario (solo admin)
```json
Headers:
Authorization: Bearer <admin-token>

Request:
{
  "email": "user@example.com",
  "password": "password123",
  "name": "New User",
  "role": "viewer"  // opcional, default: viewer
}

Response:
{
  "success": true,
  "user": { ... }
}
```

#### POST /api/auth/change-password
Cambiar contraseña (requiere autenticación)
```json
Headers:
Authorization: Bearer <token>

Request:
{
  "oldPassword": "current123",
  "newPassword": "newpassword123"
}

Response:
{
  "success": true,
  "message": "Password changed successfully. Please login again."
}
```

## 🔧 Dependencias Necesarias

Instala las siguientes dependencias en el backend:

```bash
cd videoGenerator
npm install bcrypt jsonwebtoken
npm install --save-dev @types/bcrypt @types/jsonwebtoken
```

## 🧪 Probar el Sistema

### 1. Aplicar migración de base de datos
```bash
psql -U postgres -d youtube_shorts_db -f database/migrations/010_add_authentication_system.sql
```

### 2. Iniciar el backend
```bash
cd videoGenerator
npm run dev
```

### 3. Iniciar el frontend
```bash
cd videoGeneratorApp
npm start
```

### 4. Probar login
1. Navega a `http://localhost:4200/login`
2. Ingresa:
   - Email: `admin@videogenerator.com`
   - Password: `admin123`
3. Deberías ser redirigido al dashboard

## 📊 Monitoreo

### Ver sesiones activas
```sql
SELECT u.email, s.ip_address, s.created_at, s.expires_at
FROM sessions s
JOIN users u ON s.user_id = u.id
WHERE s.expires_at > NOW()
ORDER BY s.created_at DESC;
```

### Ver registro de auditoría
```sql
SELECT 
  u.email,
  al.action,
  al.success,
  al.error_message,
  al.ip_address,
  al.created_at
FROM auth_audit_log al
LEFT JOIN users u ON al.user_id = u.id
ORDER BY al.created_at DESC
LIMIT 50;
```

### Limpiar tokens expirados
```sql
SELECT clean_expired_sessions();
SELECT clean_expired_refresh_tokens();
```

## 🔐 Seguridad

### Recomendaciones para Producción

1. **Cambiar JWT_SECRET**: Usa un valor aleatorio y seguro
2. **HTTPS**: Usa siempre HTTPS en producción
3. **Cambiar contraseña del admin**: Inmediatamente después del primer login
4. **Rate Limiting**: Implementar límites de intentos de login
5. **CORS**: Configurar correctamente las URLs permitidas
6. **Variables de entorno**: Nunca commitees secretos al repositorio

### Generar JWT Secret seguro
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## 🐛 Troubleshooting

### Error: "Invalid or expired token"
- Verifica que el token no haya expirado
- Usa el refresh token para obtener uno nuevo
- Verifica que JWT_SECRET sea el mismo en todas las instancias

### Error: "User not found"
- Verifica que la migración se haya ejecutado correctamente
- Verifica que exista el usuario admin en la base de datos

### Error de CORS
- Verifica que `DASHBOARD_URL` en `.env` coincida con la URL del frontend
- Revisa la configuración de CORS en `api-app.ts`

## 📝 Próximos Pasos

- [ ] Implementar "Olvidé mi contraseña"
- [ ] Agregar verificación de email
- [ ] Implementar 2FA (autenticación de dos factores)
- [ ] Agregar rate limiting para prevenir ataques de fuerza bruta
- [ ] Implementar gestión de usuarios en el dashboard
