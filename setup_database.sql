-- Script completo para configurar la base de datos de Barbería RD
-- Ejecutar en orden para asegurar que las dependencias se resuelven correctamente

-- 1. Primero creamos la función para actualizar automáticamente el campo updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Crear tabla de usuarios (la más básica, sin dependencias)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(20) NOT NULL DEFAULT 'client', -- client, barber, admin, owner
    phone VARCHAR(20),
    profile_image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Crear tabla de barberías
CREATE TABLE IF NOT EXISTS barber_shops (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(255),
    logo_url TEXT,
    cover_photo_url TEXT,
    description TEXT,
    owner_id INTEGER REFERENCES users(id) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Crear tabla de categorías de servicios
CREATE TABLE IF NOT EXISTS service_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    shop_id INTEGER REFERENCES barber_shops(id) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. Crear tabla de servicios maestros
CREATE TABLE IF NOT EXISTS masterservices (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    base_price DECIMAL(10, 2) NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    category_id INTEGER REFERENCES service_categories(id),
    shop_id INTEGER REFERENCES barber_shops(id) NOT NULL,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. Crear tabla de barberos
CREATE TABLE IF NOT EXISTS barbers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) UNIQUE NOT NULL,
    shop_id INTEGER REFERENCES barber_shops(id) NOT NULL,
    description TEXT,
    years_experience INTEGER,
    rating DECIMAL(3, 2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 7. Crear tabla de asignación de servicios a barberos
CREATE TABLE IF NOT EXISTS barber_services (
    id SERIAL PRIMARY KEY,
    barber_id INTEGER REFERENCES barbers(id) NOT NULL,
    service_id INTEGER REFERENCES masterservices(id) NOT NULL,
    price_adjustment DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(barber_id, service_id)
);

-- 8. Crear tabla de horarios de trabajo
CREATE TABLE IF NOT EXISTS work_schedules (
    id SERIAL PRIMARY KEY,
    barber_id INTEGER REFERENCES barbers(id) NOT NULL,
    day_of_week INTEGER NOT NULL, -- 0=Domingo, 1=Lunes, ..., 6=Sábado
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_day_off BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 9. Crear tabla de citas
CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES users(id) NOT NULL,
    barber_id INTEGER REFERENCES barbers(id) NOT NULL,
    service_id INTEGER REFERENCES masterservices(id) NOT NULL,
    shop_id INTEGER REFERENCES barber_shops(id) NOT NULL,
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, completed, cancelled
    notes TEXT,
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 10. Crear tabla de productos
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock INTEGER DEFAULT 0,
    shop_id INTEGER REFERENCES barber_shops(id) NOT NULL,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 11. Crear tabla para fotos de barberías
CREATE TABLE IF NOT EXISTS shopphotos (
    photo_id SERIAL PRIMARY KEY,
    shop_id INTEGER REFERENCES barber_shops(id) NOT NULL,
    photo_url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 12. Crear tabla para archivos adjuntos a citas
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

-- 13. Crear tabla para imágenes "antes y después" de citas
CREATE TABLE IF NOT EXISTS appointment_before_after (
    before_after_id SERIAL PRIMARY KEY,
    appointment_id INTEGER REFERENCES appointments(id) NOT NULL UNIQUE,
    before_image_url TEXT,
    after_image_url TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 14. Crear índices para mejorar el rendimiento de las consultas
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_barber_shops_owner ON barber_shops(owner_id);
CREATE INDEX IF NOT EXISTS idx_services_shop ON masterservices(shop_id);
CREATE INDEX IF NOT EXISTS idx_barbers_shop ON barbers(shop_id);
CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_barber ON appointments(barber_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_shopphotos_shop_id ON shopphotos(shop_id);
CREATE INDEX IF NOT EXISTS idx_appointment_attachments_appointment_id ON appointment_attachments(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_before_after_appointment_id ON appointment_before_after(appointment_id);

-- 15. Crear triggers para actualizar automáticamente los timestamps
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('users', 'barber_shops', 'service_categories', 'masterservices', 
                          'barbers', 'barber_services', 'work_schedules', 'appointments', 
                          'products', 'shopphotos', 'appointment_attachments', 'appointment_before_after')
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

-- 16. Insertar algunos datos de ejemplo (opcional)
-- Descomentar si quieres cargar datos de ejemplo

/*
-- Insertar usuario administrador
INSERT INTO users (username, email, password, first_name, last_name, role)
VALUES ('admin', 'admin@barberiard.com', '$2a$10$JwYX5QsZ9SJg.Yt2Ul68IO.LHCeTHk79zKrjUK7MFVM3FVNR8MlZm', 'Admin', 'User', 'admin');

-- Insertar propietario de barbería
INSERT INTO users (username, email, password, first_name, last_name, role)
VALUES ('owner', 'owner@barberiard.com', '$2a$10$JwYX5QsZ9SJg.Yt2Ul68IO.LHCeTHk79zKrjUK7MFVM3FVNR8MlZm', 'Owner', 'User', 'owner');

-- Insertar barbería
INSERT INTO barber_shops (name, address, city, state, country, owner_id, description)
VALUES ('Barbería Moderna RD', 'Calle Principal #123', 'Santo Domingo', 'Distrito Nacional', 'República Dominicana', 2, 'La mejor barbería de la ciudad');
*/
