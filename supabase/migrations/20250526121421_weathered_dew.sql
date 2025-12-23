-- Create database (run this separately if needed)
-- CREATE DATABASE barberapp;

-- Connect to the database
-- \c barberapp

-- Create enum types
CREATE TYPE user_role_enum AS ENUM ('client', 'barber', 'owner');
CREATE TYPE day_of_week_enum AS ENUM ('L', 'M', 'X', 'J', 'V', 'S', 'D');
CREATE TYPE appointment_status_enum AS ENUM (
  'confirmed',
  'completed',
  'cancelled_by_client',
  'cancelled_by_barber',
  'cancelled_by_owner',
  'no_show'
);

-- Users table
CREATE TABLE users (
  user_id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone TEXT,
  role user_role_enum NOT NULL,
  profile_image_url TEXT,
  shop_id INTEGER, -- For barbers, references barbershops
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Barbershops table
CREATE TABLE barbershops (
  shop_id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(user_id),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  phone TEXT NOT NULL,
  rating_avg NUMERIC(2,1) DEFAULT 0.0,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraint to users table
ALTER TABLE users ADD CONSTRAINT fk_users_shop FOREIGN KEY (shop_id) REFERENCES barbershops(shop_id) ON DELETE SET NULL;

-- Shop photos
CREATE TABLE shopphotos (
  photo_id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES barbershops(shop_id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  uploaded_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Shop opening hours
CREATE TABLE shopopeninghours (
  shop_opening_hour_id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES barbershops(shop_id) ON DELETE CASCADE,
  day_of_week day_of_week_enum NOT NULL,
  opening_time TIME WITHOUT TIME ZONE,
  closing_time TIME WITHOUT TIME ZONE,
  is_closed BOOLEAN DEFAULT false,
  UNIQUE(shop_id, day_of_week)
);

-- Master services catalog
CREATE TABLE masterservices (
  master_service_id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  base_price NUMERIC(10,2) NOT NULL,
  base_duration_minutes INTEGER NOT NULL,
  is_global BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Shop master services (which services each shop offers)
CREATE TABLE shopmasterservices (
  shop_id INTEGER NOT NULL REFERENCES barbershops(shop_id) ON DELETE CASCADE,
  master_service_id INTEGER NOT NULL REFERENCES masterservices(master_service_id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (shop_id, master_service_id)
);

-- Barber services (customizations of master services by barbers)
CREATE TABLE barberservices (
  barber_service_id SERIAL PRIMARY KEY,
  barber_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  master_service_id INTEGER REFERENCES masterservices(master_service_id) ON DELETE SET NULL,
  personal_name TEXT,
  personal_description TEXT,
  price_by_barber NUMERIC(10,2),
  duration_by_barber INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Barber availability
CREATE TABLE barberavailability (
  availability_id SERIAL PRIMARY KEY,
  barber_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  day_of_week day_of_week_enum NOT NULL,
  start_time_local TIME WITHOUT TIME ZONE NOT NULL,
  end_time_local TIME WITHOUT TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(barber_id, day_of_week, start_time_local)
);

-- Appointments
CREATE TABLE appointments (
  appointment_id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  shop_id INTEGER NOT NULL REFERENCES barbershops(shop_id) ON DELETE CASCADE,
  barber_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  barber_service_id INTEGER NOT NULL REFERENCES barberservices(barber_service_id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'completed', 'cancelled_by_client', 'cancelled_by_barber', 'cancelled_by_owner', 'no_show')),
  notes_client TEXT,
  notes_barber TEXT,
  price_at_booking NUMERIC(10,2) NOT NULL,
  client_phone_at_booking TEXT,
  client_reviewed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Reviews
CREATE TABLE reviews (
  review_id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES barbershops(shop_id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  appointment_id INTEGER REFERENCES appointments(appointment_id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  review_date TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Products
CREATE TABLE products (
  product_id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  stock INTEGER NOT NULL,
  photo_url TEXT,
  category TEXT,
  offer TEXT,
  shop_id INTEGER REFERENCES barbershops(shop_id) ON DELETE CASCADE,
  barber_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Product sales
CREATE TABLE productsales (
  sale_id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  sale_date TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  shop_id INTEGER NOT NULL REFERENCES barbershops(shop_id) ON DELETE CASCADE,
  barber_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX idx_appointments_barber_id ON appointments(barber_id);
CREATE INDEX idx_appointments_shop_id ON appointments(shop_id);
CREATE INDEX idx_appointments_start_time ON appointments(start_time);
CREATE INDEX idx_products_barber_id ON products(barber_id);
CREATE INDEX idx_products_shop_id ON products(shop_id);
CREATE INDEX idx_users_email ON users(email);