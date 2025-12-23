-- Estructura de la base de datos para la Barbería
-- Primero creamos todas las tablas sin referencias

-- Tabla de usuarios (sin referencias inicialmente)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(50) UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    telefono VARCHAR(20),
    password VARCHAR(100) NOT NULL,
    rol VARCHAR(20) NOT NULL, -- 'barber', 'client', 'admin'
    especialidades TEXT[],
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de barberías (sin referencias inicialmente)
CREATE TABLE barber_shops (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(50) UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    direccion VARCHAR(200),
    horario JSONB,
    rating NUMERIC(2,1),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de servicios (sin referencias inicialmente)
CREATE TABLE services (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(50) UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    precio NUMERIC(10,2) NOT NULL,
    duracion INT NOT NULL, -- minutos
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de citas (sin referencias inicialmente)
CREATE TABLE appointments (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(50) UNIQUE,
    fecha TIMESTAMP NOT NULL,
    estado VARCHAR(20) NOT NULL, -- confirmed, completed, cancelled, no-show
    notas TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de productos (sin referencias inicialmente)
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(50) UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    precio NUMERIC(10,2) NOT NULL,
    oferta NUMERIC(10,2),
    stock INT DEFAULT 0,
    imagen_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de reseñas (sin referencias inicialmente)
CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(50) UNIQUE,
    rating INT CHECK (rating >= 1 AND rating <= 5),
    comentario TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de notas extra para citas (sin referencias inicialmente)
CREATE TABLE appointment_notes (
    id SERIAL PRIMARY KEY,
    nota TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de servicios extra añadidos a una cita (sin referencias inicialmente)
CREATE TABLE appointment_extras (
    id SERIAL PRIMARY KEY,
    precio NUMERIC(10,2),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de historial de estados de cita (sin referencias inicialmente)
CREATE TABLE appointment_status_history (
    id SERIAL PRIMARY KEY,
    estado VARCHAR(20),
    changed_at TIMESTAMP DEFAULT NOW()
);

-- Ahora añadimos todas las referencias mediante ALTER TABLE

-- Referencias para users
ALTER TABLE users ADD COLUMN shop_id INTEGER;
ALTER TABLE users ADD CONSTRAINT fk_users_shop FOREIGN KEY (shop_id) REFERENCES barber_shops(id);

-- Referencias para barber_shops
ALTER TABLE barber_shops ADD COLUMN owner_id INTEGER;
ALTER TABLE barber_shops ADD CONSTRAINT fk_barber_shops_owner FOREIGN KEY (owner_id) REFERENCES users(id);

-- Referencias para services
ALTER TABLE services ADD COLUMN shop_id INTEGER;
ALTER TABLE services ADD CONSTRAINT fk_services_shop FOREIGN KEY (shop_id) REFERENCES barber_shops(id);

-- Referencias para appointments
ALTER TABLE appointments ADD COLUMN cliente_id INTEGER;
ALTER TABLE appointments ADD COLUMN barber_id INTEGER;
ALTER TABLE appointments ADD COLUMN shop_id INTEGER;
ALTER TABLE appointments ADD COLUMN service_id INTEGER;
ALTER TABLE appointments ADD CONSTRAINT fk_appointments_cliente FOREIGN KEY (cliente_id) REFERENCES users(id);
ALTER TABLE appointments ADD CONSTRAINT fk_appointments_barber FOREIGN KEY (barber_id) REFERENCES users(id);
ALTER TABLE appointments ADD CONSTRAINT fk_appointments_shop FOREIGN KEY (shop_id) REFERENCES barber_shops(id);
ALTER TABLE appointments ADD CONSTRAINT fk_appointments_service FOREIGN KEY (service_id) REFERENCES services(id);

-- Referencias para products
ALTER TABLE products ADD COLUMN shop_id INTEGER;
ALTER TABLE products ADD CONSTRAINT fk_products_shop FOREIGN KEY (shop_id) REFERENCES barber_shops(id);

-- Referencias para reviews
ALTER TABLE reviews ADD COLUMN user_id INTEGER;
ALTER TABLE reviews ADD COLUMN shop_id INTEGER;
ALTER TABLE reviews ADD CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE reviews ADD CONSTRAINT fk_reviews_shop FOREIGN KEY (shop_id) REFERENCES barber_shops(id);

-- Referencias para appointment_notes
ALTER TABLE appointment_notes ADD COLUMN appointment_id INTEGER;
ALTER TABLE appointment_notes ADD CONSTRAINT fk_appointment_notes_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id);

-- Referencias para appointment_extras
ALTER TABLE appointment_extras ADD COLUMN appointment_id INTEGER;
ALTER TABLE appointment_extras ADD COLUMN service_id INTEGER;
ALTER TABLE appointment_extras ADD CONSTRAINT fk_appointment_extras_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id);
ALTER TABLE appointment_extras ADD CONSTRAINT fk_appointment_extras_service FOREIGN KEY (service_id) REFERENCES services(id);

-- Referencias para appointment_status_history
ALTER TABLE appointment_status_history ADD COLUMN appointment_id INTEGER;
ALTER TABLE appointment_status_history ADD CONSTRAINT fk_appointment_status_history_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id);

-- Tabla de sesiones (para autenticación)
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    token VARCHAR(255) UNIQUE,
    expires_at TIMESTAMP
);
