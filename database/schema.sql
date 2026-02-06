-- ============================================
-- YOUTUBE SHORTS GENERATOR - DATABASE SCHEMA
-- PostgreSQL 12+
-- ============================================

-- 1. CREAR BASE DE DATOS Y USUARIO
-- Ejecutar como superusuario (postgres)

CREATE DATABASE youtube_shorts_db
    WITH 
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8'
    TEMPLATE = template0;

-- Crear usuario de aplicación
CREATE USER shorts_app WITH PASSWORD 'Bsj1}3$34Jz20';

-- Conectar a la base de datos
\c youtube_shorts_db;

-- Otorgar permisos
GRANT CONNECT ON DATABASE youtube_shorts_db TO shorts_app;
GRANT USAGE, CREATE ON SCHEMA public TO shorts_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO shorts_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO shorts_app;

-- ============================================
-- 2. EXTENSIONES
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 3. TIPOS ENUMERADOS
-- ============================================

CREATE TYPE execution_status AS ENUM ('running', 'completed', 'failed');
CREATE TYPE language_type AS ENUM ('es', 'en');
CREATE TYPE privacy_status AS ENUM ('public', 'unlisted', 'private');

-- ============================================
-- 4. TABLAS
-- ============================================

-- 4.1 Pipeline Executions
CREATE TABLE pipeline_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    status execution_status NOT NULL DEFAULT 'running',
    error_message TEXT,
    duration_seconds INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE pipeline_executions IS 'Registro de cada ejecución del pipeline completo';
COMMENT ON COLUMN pipeline_executions.duration_seconds IS 'Duración total de la ejecución en segundos';

-- 4.2 Topics
CREATE TABLE topics (
    id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    execution_id UUID REFERENCES pipeline_executions(id) ON DELETE CASCADE,
    openai_model VARCHAR(50),
    openai_tokens_used INTEGER,
    raw_response JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE topics IS 'Topics generados por IA para micro-documentales';
COMMENT ON COLUMN topics.raw_response IS 'Respuesta completa de OpenAI en formato JSON';

-- 4.3 Scripts
CREATE TABLE scripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id VARCHAR(100) NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    language language_type NOT NULL,
    title VARCHAR(200) NOT NULL,
    narrative TEXT NOT NULL,
    description TEXT,
    tags JSONB,
    estimated_duration INTEGER,
    word_count INTEGER,
    generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    openai_model VARCHAR(50),
    openai_tokens_used INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(topic_id, language)
);

COMMENT ON TABLE scripts IS 'Guiones generados por IA en ambos idiomas';
COMMENT ON COLUMN scripts.estimated_duration IS 'Duración estimada en segundos';
COMMENT ON COLUMN scripts.word_count IS 'Número de palabras del narrative';

-- 4.4 Videos
CREATE TABLE videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
    language language_type NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    duration_seconds INTEGER NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    file_size_mb DECIMAL(10,2),
    audio_voice VARCHAR(100),
    audio_file_path VARCHAR(500),
    subtitles_file_path VARCHAR(500),
    generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    processing_time_seconds INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE videos IS 'Videos generados con FFmpeg';
COMMENT ON COLUMN videos.file_size_mb IS 'Tamaño del archivo en megabytes';
COMMENT ON COLUMN videos.processing_time_seconds IS 'Tiempo de procesamiento de FFmpeg';

-- 4.5 YouTube Uploads
CREATE TABLE youtube_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    youtube_video_id VARCHAR(50) UNIQUE NOT NULL,
    youtube_url VARCHAR(200) NOT NULL,
    channel language_type NOT NULL,
    title VARCHAR(200) NOT NULL,
    uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
    privacy_status privacy_status NOT NULL DEFAULT 'public',
    upload_duration_seconds INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE youtube_uploads IS 'Registro de videos subidos a YouTube';
COMMENT ON COLUMN youtube_uploads.youtube_video_id IS 'ID único del video en YouTube';

-- 4.6 YouTube Analytics
CREATE TABLE youtube_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    upload_id UUID NOT NULL REFERENCES youtube_uploads(id) ON DELETE CASCADE,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    dislikes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    watch_time_hours DECIMAL(10,2) DEFAULT 0,
    ctr_percent DECIMAL(5,2),
    avg_view_duration_seconds INTEGER,
    fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE youtube_analytics IS 'Métricas de YouTube actualizadas periódicamente';
COMMENT ON COLUMN youtube_analytics.ctr_percent IS 'Click-through rate en porcentaje';
COMMENT ON COLUMN youtube_analytics.watch_time_hours IS 'Tiempo total de visualización en horas';

-- 4.7 Resource Usage
CREATE TABLE resource_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID NOT NULL REFERENCES pipeline_executions(id) ON DELETE CASCADE,
    openai_tokens_total INTEGER DEFAULT 0,
    openai_cost_usd DECIMAL(10,4) DEFAULT 0,
    storage_used_mb DECIMAL(10,2) DEFAULT 0,
    processing_time_seconds INTEGER DEFAULT 0,
    edge_tts_duration_seconds INTEGER DEFAULT 0,
    ffmpeg_duration_seconds INTEGER DEFAULT 0,
    recorded_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE resource_usage IS 'Registro de uso de recursos y costos por ejecución';
COMMENT ON COLUMN resource_usage.openai_cost_usd IS 'Costo estimado de OpenAI en USD';

-- 4.8 Error Logs
CREATE TABLE error_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID REFERENCES pipeline_executions(id) ON DELETE CASCADE,
    error_type VARCHAR(100),
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    context JSONB,
    occurred_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE error_logs IS 'Registro detallado de errores durante la ejecución';

-- ============================================
-- 5. ÍNDICES
-- ============================================

-- Pipeline Executions
CREATE INDEX idx_pipeline_executions_status ON pipeline_executions(status);
CREATE INDEX idx_pipeline_executions_started_at ON pipeline_executions(started_at DESC);

-- Topics
CREATE INDEX idx_topics_execution_id ON topics(execution_id);
CREATE INDEX idx_topics_generated_at ON topics(generated_at DESC);
CREATE INDEX idx_topics_title ON topics USING gin(to_tsvector('english', title));

-- Scripts
CREATE INDEX idx_scripts_topic_id ON scripts(topic_id);
CREATE INDEX idx_scripts_language ON scripts(language);
CREATE INDEX idx_scripts_generated_at ON scripts(generated_at DESC);

-- Videos
CREATE INDEX idx_videos_script_id ON videos(script_id);
CREATE INDEX idx_videos_language ON videos(language);
CREATE INDEX idx_videos_generated_at ON videos(generated_at DESC);

-- YouTube Uploads
CREATE INDEX idx_youtube_uploads_video_id ON youtube_uploads(video_id);
CREATE INDEX idx_youtube_uploads_channel ON youtube_uploads(channel);
CREATE INDEX idx_youtube_uploads_youtube_video_id ON youtube_uploads(youtube_video_id);
CREATE INDEX idx_youtube_uploads_uploaded_at ON youtube_uploads(uploaded_at DESC);

-- YouTube Analytics
CREATE INDEX idx_youtube_analytics_upload_id ON youtube_analytics(upload_id);
CREATE INDEX idx_youtube_analytics_fetched_at ON youtube_analytics(fetched_at DESC);
CREATE INDEX idx_youtube_analytics_views ON youtube_analytics(views DESC);

-- Resource Usage
CREATE INDEX idx_resource_usage_execution_id ON resource_usage(execution_id);
CREATE INDEX idx_resource_usage_recorded_at ON resource_usage(recorded_at DESC);

-- Error Logs
CREATE INDEX idx_error_logs_execution_id ON error_logs(execution_id);
CREATE INDEX idx_error_logs_error_type ON error_logs(error_type);
CREATE INDEX idx_error_logs_occurred_at ON error_logs(occurred_at DESC);

-- ============================================
-- 6. TRIGGERS PARA UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pipeline_executions_updated_at
    BEFORE UPDATE ON pipeline_executions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. VISTAS ÚTILES
-- ============================================

-- Vista: Estadísticas por Topic
CREATE VIEW topic_performance AS
SELECT 
    t.id,
    t.title,
    t.description,
    COUNT(DISTINCT s.id) as scripts_count,
    COUNT(DISTINCT v.id) as videos_count,
    COUNT(DISTINCT yu.id) as uploads_count,
    COALESCE(SUM(ya.views), 0) as total_views,
    COALESCE(SUM(ya.likes), 0) as total_likes,
    COALESCE(AVG(ya.ctr_percent), 0) as avg_ctr,
    t.generated_at
FROM topics t
LEFT JOIN scripts s ON t.id = s.topic_id
LEFT JOIN videos v ON s.id = v.script_id
LEFT JOIN youtube_uploads yu ON v.id = yu.video_id
LEFT JOIN youtube_analytics ya ON yu.id = ya.upload_id
GROUP BY t.id, t.title, t.description, t.generated_at
ORDER BY total_views DESC;

-- Vista: Resumen de Costos
CREATE VIEW cost_summary AS
SELECT 
    DATE(pe.started_at) as execution_date,
    COUNT(pe.id) as executions_count,
    SUM(ru.openai_tokens_total) as total_tokens,
    SUM(ru.openai_cost_usd) as total_cost_usd,
    SUM(ru.storage_used_mb) as total_storage_mb,
    AVG(pe.duration_seconds) as avg_duration_seconds
FROM pipeline_executions pe
LEFT JOIN resource_usage ru ON pe.id = ru.execution_id
WHERE pe.status = 'completed'
GROUP BY DATE(pe.started_at)
ORDER BY execution_date DESC;

-- Vista: Performance de Canales
CREATE VIEW channel_performance AS
SELECT 
    yu.channel,
    COUNT(yu.id) as videos_uploaded,
    COALESCE(SUM(ya.views), 0) as total_views,
    COALESCE(SUM(ya.likes), 0) as total_likes,
    COALESCE(SUM(ya.comments), 0) as total_comments,
    COALESCE(AVG(ya.ctr_percent), 0) as avg_ctr,
    COALESCE(AVG(ya.avg_view_duration_seconds), 0) as avg_watch_time
FROM youtube_uploads yu
LEFT JOIN youtube_analytics ya ON yu.id = ya.upload_id
GROUP BY yu.channel;

-- ============================================
-- 8. FUNCIONES ÚTILES
-- ============================================

-- Función: Verificar topics duplicados
CREATE OR REPLACE FUNCTION check_duplicate_topic(topic_title TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS(SELECT 1 FROM topics WHERE LOWER(title) = LOWER(topic_title));
END;
$$ LANGUAGE plpgsql;

-- Función: Calcular costo de tokens OpenAI
CREATE OR REPLACE FUNCTION calculate_openai_cost(tokens INTEGER, model VARCHAR)
RETURNS DECIMAL AS $$
DECLARE
    cost_per_1k DECIMAL := 0.03; -- GPT-4 default
BEGIN
    IF model LIKE 'gpt-4%' THEN
        cost_per_1k := 0.03;
    ELSIF model LIKE 'gpt-3.5%' THEN
        cost_per_1k := 0.002;
    END IF;
    
    RETURN (tokens::DECIMAL / 1000.0) * cost_per_1k;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. DATOS INICIALES (OPCIONAL)
-- ============================================

-- Insertar registro de prueba (comentado por defecto)
-- INSERT INTO pipeline_executions (status) VALUES ('running');

-- ============================================
-- 10. PERMISOS FINALES
-- ============================================

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO shorts_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO shorts_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO shorts_app;

-- ============================================
-- SCRIPT COMPLETADO
-- ============================================

-- Verificación
SELECT 'Database schema created successfully!' AS status;

-- Mostrar tablas creadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;
