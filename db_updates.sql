-- Script para actualizar la base de datos y soportar el almacenamiento de imágenes y archivos
-- Ejecutar este script para añadir las tablas y columnas necesarias

-- Actualizar tabla de productos para asegurar que tiene soporte para imágenes
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Actualizar tabla de usuarios para asegurar que tiene soporte para imágenes de perfil
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS profile_image_url TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Actualizar tabla de masterservices para soportar imágenes
ALTER TABLE masterservices 
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Tabla para almacenar fotos de barberías
CREATE TABLE IF NOT EXISTS shopphotos (
    photo_id SERIAL PRIMARY KEY,
    shop_id INTEGER REFERENCES barber_shops(id) NOT NULL,
    photo_url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla para almacenar archivos adjuntos a citas
CREATE TABLE IF NOT EXISTS appointment_attachments (
    attachment_id SERIAL PRIMARY KEY,
    appointment_id INTEGER REFERENCES appointments(id) NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(50), -- 'image', 'document', etc.
    description TEXT,
    uploaded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla para almacenar imágenes "antes y después" de citas
CREATE TABLE IF NOT EXISTS appointment_before_after (
    before_after_id SERIAL PRIMARY KEY,
    appointment_id INTEGER REFERENCES appointments(id) NOT NULL UNIQUE,
    before_image_url TEXT,
    after_image_url TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Crear índices para mejorar el rendimiento de las consultas
CREATE INDEX IF NOT EXISTS idx_shopphotos_shop_id ON shopphotos(shop_id);
CREATE INDEX IF NOT EXISTS idx_appointment_attachments_appointment_id ON appointment_attachments(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_before_after_appointment_id ON appointment_before_after(appointment_id);

-- Crear función para actualizar automáticamente los timestamps de updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear triggers para actualizar automáticamente los timestamps
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('users', 'products', 'masterservices', 'shopphotos', 
                          'appointment_attachments', 'appointment_before_after')
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_%s_modtime ON %s;
            CREATE TRIGGER update_%s_modtime
            BEFORE UPDATE ON %s
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
        ', t, t, t, t);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Asegurar que existan las carpetas para almacenamiento
-- Nota: Este comentario es solo informativo, la creación de carpetas se hace en el código Node.js
-- Las carpetas necesarias son:
-- - /uploads/profile (fotos de perfil)
-- - /uploads/product (imágenes de productos)
-- - /uploads/shop (fotos de barberías)
-- - /uploads/service (imágenes de servicios)
-- - /uploads/appointment (archivos relacionados con citas)
-- - /uploads/misc (otros archivos)
