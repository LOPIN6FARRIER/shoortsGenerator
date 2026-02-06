# 🗄️ Configuración de Base de Datos PostgreSQL

## 📋 Instalación en VPS

### 1. Instalar PostgreSQL

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# Verificar instalación
psql --version
```

### 2. Configurar PostgreSQL

```bash
# Iniciar servicio
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verificar status
sudo systemctl status postgresql
```

### 3. Crear Base de Datos y Usuario

```bash
# Conectar como usuario postgres
sudo -u postgres psql

# Dentro de psql, ejecutar el script completo:
\i /ruta/a/database/schema.sql

# O ejecutar paso por paso:
```

#### Opción A: Ejecución automática del script

```bash
# Desde la terminal (fuera de psql)
sudo -u postgres psql -f database/schema.sql
```

#### Opción B: Ejecución manual

```sql
-- 1. Crear base de datos
CREATE DATABASE youtube_shorts_db
    WITH 
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8'
    TEMPLATE = template0;

-- 2. Crear usuario
CREATE USER shorts_app WITH PASSWORD 'TU_PASSWORD_SEGURA_AQUI';

-- 3. Conectar a la nueva base de datos
\c youtube_shorts_db;

-- 4. Copiar y pegar el resto del contenido de database/schema.sql
```

### 4. Configurar Variables de Entorno

Editar `.env`:

```bash
nano .env
```

```env
# Opción 1: Connection string (recomendado)
DATABASE_URL=postgresql://shorts_app:tu_password@localhost:5432/youtube_shorts_db

# Opción 2: Parámetros separados
DB_HOST=localhost
DB_PORT=5432
DB_NAME=youtube_shorts_db
DB_USER=shorts_app
DB_PASSWORD=tu_password
```

### 5. Verificar Conexión

```bash
# Desde el proyecto
npm run check

# O probar manualmente
psql -h localhost -U shorts_app -d youtube_shorts_db
```

## 🔐 Seguridad

### Cambiar contraseña del usuario

```sql
ALTER USER shorts_app WITH PASSWORD 'nueva_password_segura';
```

### Permitir conexiones remotas (si es necesario)

```bash
# Editar pg_hba.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf

# Agregar línea:
# host    youtube_shorts_db    shorts_app    192.168.1.0/24    md5

# Reiniciar PostgreSQL
sudo systemctl restart postgresql
```

### Configurar firewall

```bash
# Solo si necesitas acceso remoto
sudo ufw allow 5432/tcp
```

## 📊 Comandos Útiles

### Dentro de psql

```sql
-- Listar bases de datos
\l

-- Conectar a base de datos
\c youtube_shorts_db

-- Listar tablas
\dt

-- Describir tabla
\d pipeline_executions

-- Ver permisos
\dp

-- Salir
\q
```

### Desde terminal

```bash
# Backup de la base de datos
pg_dump -U shorts_app -h localhost youtube_shorts_db > backup.sql

# Restaurar backup
psql -U shorts_app -h localhost youtube_shorts_db < backup.sql

# Ver logs de PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

## 📈 Consultas Útiles

### Ver últimas ejecuciones

```sql
SELECT id, status, started_at, duration_seconds 
FROM pipeline_executions 
ORDER BY started_at DESC 
LIMIT 10;
```

### Ver topics más exitosos

```sql
SELECT * FROM topic_performance 
ORDER BY total_views DESC 
LIMIT 10;
```

### Ver costos acumulados

```sql
SELECT * FROM cost_summary 
ORDER BY execution_date DESC 
LIMIT 30;
```

### Ver rendimiento por canal

```sql
SELECT * FROM channel_performance;
```

### Ver errores recientes

```sql
SELECT error_type, error_message, occurred_at 
FROM error_logs 
ORDER BY occurred_at DESC 
LIMIT 20;
```

## 🔧 Mantenimiento

### Limpiar datos antiguos (>90 días)

```sql
DELETE FROM pipeline_executions 
WHERE started_at < NOW() - INTERVAL '90 days';
```

### Ver tamaño de la base de datos

```sql
SELECT 
    pg_database.datname,
    pg_size_pretty(pg_database_size(pg_database.datname)) AS size
FROM pg_database
WHERE datname = 'youtube_shorts_db';
```

### Vacuum y análisis

```sql
VACUUM ANALYZE;
```

## 🚨 Troubleshooting

### Error: "role does not exist"

```bash
sudo -u postgres createuser shorts_app
```

### Error: "database does not exist"

```bash
sudo -u postgres createdb youtube_shorts_db
```

### Error: "password authentication failed"

```bash
# Verificar archivo pg_hba.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf

# Debe tener una línea como:
# local   all             all                                     md5
```

### Error: "could not connect to server"

```bash
# Verificar que PostgreSQL esté corriendo
sudo systemctl status postgresql

# Si no está corriendo:
sudo systemctl start postgresql
```

## 📚 Referencias

- [PostgreSQL Official Docs](https://www.postgresql.org/docs/)
- [node-postgres (pg) Docs](https://node-postgres.com/)
- [SQL Best Practices](https://www.postgresql.org/docs/current/tutorial-sql.html)
