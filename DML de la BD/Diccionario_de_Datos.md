# Diccionario de Datos — Proyecto X

## Fuente
- `backend/src/db/schema.sql`
- `backend/src/db/barber_breaks.sql`

> Nota: Este diccionario describe el esquema esperado por el backend actual (Node/Express + Postgres).

---

## Tabla: `users`
**Descripción**: Usuarios del sistema (barbero/cliente/owner).

| Campo | Tipo | Nulo | Default | Clave | Referencia | Descripción |
|---|---|---:|---|---|---|---|
| id | SERIAL | No |  | PK |  | Identificador interno |
| uuid | VARCHAR(50) | Sí |  | UK |  | Identificador alterno |
| name | VARCHAR(100) | No |  |  |  | Nombre |
| email | VARCHAR(100) | No |  | UK |  | Correo |
| phone | VARCHAR(20) | Sí |  |  |  | Teléfono |
| password | VARCHAR(100) | No |  |  |  | Hash/clave |
| role | VARCHAR(20) | No |  |  |  | Rol (`barber`, `client`, `owner`) |
| specialties | TEXT[] | Sí |  |  |  | Especialidades |
| created_at | TIMESTAMP | Sí | NOW() |  |  | Creación |
| updated_at | TIMESTAMP | Sí | NOW() |  |  | Actualización |
| shop_id | INTEGER | Sí |  | FK | barber_shops(id) | Barbería asignada (si aplica) |

---

## Tabla: `barber_shops`
**Descripción**: Barberías registradas.

| Campo | Tipo | Nulo | Default | Clave | Referencia | Descripción |
|---|---|---:|---|---|---|---|
| id | SERIAL | No |  | PK |  | Identificador |
| uuid | VARCHAR(50) | Sí |  | UK |  | Identificador alterno |
| name | VARCHAR(100) | No |  |  |  | Nombre |
| address | VARCHAR(200) | Sí |  |  |  | Dirección |
| schedule | JSONB | Sí |  |  |  | Horario/config |
| rating | NUMERIC(2,1) | Sí |  |  |  | Rating promedio |
| created_at | TIMESTAMP | Sí | NOW() |  |  | Creación |
| updated_at | TIMESTAMP | Sí | NOW() |  |  | Actualización |
| owner_id | INTEGER | Sí |  | FK | users(id) | Owner/propietario |

---

## Tabla: `services`
**Descripción**: Servicios ofrecidos por barbería.

| Campo | Tipo | Nulo | Default | Clave | Referencia | Descripción |
|---|---|---:|---|---|---|---|
| id | SERIAL | No |  | PK |  | Identificador |
| uuid | VARCHAR(50) | Sí |  | UK |  | Identificador alterno |
| name | VARCHAR(100) | No |  |  |  | Nombre |
| description | TEXT | Sí |  |  |  | Descripción |
| price | NUMERIC(10,2) | No |  |  |  | Precio |
| duration | INT | No |  |  |  | Duración (minutos) |
| created_at | TIMESTAMP | Sí | NOW() |  |  | Creación |
| updated_at | TIMESTAMP | Sí | NOW() |  |  | Actualización |
| shop_id | INTEGER | Sí |  | FK | barber_shops(id) | Barbería dueña |

---

## Tabla: `appointments`
**Descripción**: Citas/Reservas.

| Campo | Tipo | Nulo | Default | Clave | Referencia | Descripción |
|---|---|---:|---|---|---|---|
| id | SERIAL | No |  | PK |  | Identificador |
| uuid | VARCHAR(50) | Sí |  | UK |  | Identificador alterno |
| date | TIMESTAMP | No |  |  |  | Fecha/hora de inicio |
| status | VARCHAR(20) | No |  |  |  | Estado (`confirmed`, `completed`, `cancelled`, `no-show`, etc.) |
| notes | TEXT | Sí |  |  |  | Notas |
| created_at | TIMESTAMP | Sí | NOW() |  |  | Creación |
| updated_at | TIMESTAMP | Sí | NOW() |  |  | Actualización |
| client_id | INTEGER | Sí |  | FK | users(id) | Cliente |
| barber_id | INTEGER | Sí |  | FK | users(id) | Barbero |
| shop_id | INTEGER | Sí |  | FK | barber_shops(id) | Barbería |
| service_id | INTEGER | Sí |  | FK | services(id) | Servicio |

**Restricciones**:
- `UNIQUE (barber_id, date)` evita dos citas reales en el mismo instante para el mismo barbero.

---

## Tabla: `products`
**Descripción**: Productos de barbería.

| Campo | Tipo | Nulo | Default | Clave | Referencia | Descripción |
|---|---|---:|---|---|---|---|
| id | SERIAL | No |  | PK |  | Identificador |
| uuid | VARCHAR(50) | Sí |  | UK |  | Identificador alterno |
| name | VARCHAR(100) | No |  |  |  | Nombre |
| description | TEXT | Sí |  |  |  | Descripción |
| price | NUMERIC(10,2) | No |  |  |  | Precio |
| discount_price | NUMERIC(10,2) | Sí |  |  |  | Precio oferta |
| stock | INT | Sí | 0 |  |  | Stock |
| image_url | TEXT | Sí |  |  |  | URL de imagen |
| created_at | TIMESTAMP | Sí | NOW() |  |  | Creación |
| updated_at | TIMESTAMP | Sí | NOW() |  |  | Actualización |
| shop_id | INTEGER | Sí |  | FK | barber_shops(id) | Barbería |

---

## Tabla: `reviews`
**Descripción**: Reseñas de usuarios a barberías.

| Campo | Tipo | Nulo | Default | Clave | Referencia | Descripción |
|---|---|---:|---|---|---|---|
| id | SERIAL | No |  | PK |  | Identificador |
| uuid | VARCHAR(50) | Sí |  | UK |  | Identificador alterno |
| rating | INT | Sí |  |  |  | 1..5 (check) |
| comment | TEXT | Sí |  |  |  | Comentario |
| created_at | TIMESTAMP | Sí | NOW() |  |  | Creación |
| updated_at | TIMESTAMP | Sí | NOW() |  |  | Actualización |
| user_id | INTEGER | Sí |  | FK | users(id) | Usuario |
| shop_id | INTEGER | Sí |  | FK | barber_shops(id) | Barbería |

---

## Tabla: `appointment_notes`
**Descripción**: Notas asociadas a una cita.

| Campo | Tipo | Nulo | Default | Clave | Referencia | Descripción |
|---|---|---:|---|---|---|---|
| id | SERIAL | No |  | PK |  | Identificador |
| note | TEXT | Sí |  |  |  | Nota |
| created_at | TIMESTAMP | Sí | NOW() |  |  | Creación |
| updated_at | TIMESTAMP | Sí | NOW() |  |  | Actualización |
| appointment_id | INTEGER | Sí |  | FK | appointments(id) | Cita |

---

## Tabla: `appointment_extras`
**Descripción**: Servicios extra agregados a una cita.

| Campo | Tipo | Nulo | Default | Clave | Referencia | Descripción |
|---|---|---:|---|---|---|---|
| id | SERIAL | No |  | PK |  | Identificador |
| price | NUMERIC(10,2) | Sí |  |  |  | Precio extra |
| created_at | TIMESTAMP | Sí | NOW() |  |  | Creación |
| updated_at | TIMESTAMP | Sí | NOW() |  |  | Actualización |
| appointment_id | INTEGER | Sí |  | FK | appointments(id) | Cita |
| service_id | INTEGER | Sí |  | FK | services(id) | Servicio extra |

---

## Tabla: `appointment_status_history`
**Descripción**: Historial de cambios de estado de cita.

| Campo | Tipo | Nulo | Default | Clave | Referencia | Descripción |
|---|---|---:|---|---|---|---|
| id | SERIAL | No |  | PK |  | Identificador |
| status | VARCHAR(20) | Sí |  |  |  | Estado |
| changed_at | TIMESTAMP | Sí | NOW() |  |  | Momento del cambio |
| updated_at | TIMESTAMP | Sí | NOW() |  |  | Actualización |
| appointment_id | INTEGER | Sí |  | FK | appointments(id) | Cita |

---

## Tabla: `sessions`
**Descripción**: Sesiones/tokens de autenticación.

| Campo | Tipo | Nulo | Default | Clave | Referencia | Descripción |
|---|---|---:|---|---|---|---|
| id | SERIAL | No |  | PK |  | Identificador |
| user_id | INTEGER | Sí |  | FK | users(id) | Usuario |
| token | VARCHAR(255) | Sí |  | UK |  | Token |
| expires_at | TIMESTAMP | Sí |  |  |  | Expiración |

---

## Tabla: `conversations`
**Descripción**: Conversaciones (mensajería interna) entre usuarios.

| Campo | Tipo | Nulo | Default | Clave | Referencia | Descripción |
|---|---|---:|---|---|---|---|
| id | SERIAL | No |  | PK |  | Identificador |
| type | VARCHAR(30) | No |  |  |  | Tipo (`client_barber`, etc.) |
| client_id | INTEGER | Sí |  | FK | users(id) | Cliente |
| barber_id | INTEGER | Sí |  | FK | users(id) | Barbero |
| owner_id | INTEGER | Sí |  | FK | users(id) | Owner |
| appointment_id | INTEGER | Sí |  | FK | appointments(id) | Cita relacionada (opcional) |
| created_at | TIMESTAMP | Sí | NOW() |  |  | Creación |
| updated_at | TIMESTAMP | Sí | NOW() |  |  | Actualización |

---

## Tabla: `messages`
**Descripción**: Mensajes dentro de una conversación.

| Campo | Tipo | Nulo | Default | Clave | Referencia | Descripción |
|---|---|---:|---|---|---|---|
| id | SERIAL | No |  | PK |  | Identificador |
| conversation_id | INTEGER | No |  | FK | conversations(id) | Conversación |
| sender_id | INTEGER | No |  | FK | users(id) | Emisor |
| receiver_id | INTEGER | No |  | FK | users(id) | Receptor |
| text | TEXT | No |  |  |  | Texto |
| is_system | BOOLEAN | Sí | FALSE |  |  | Mensaje de sistema |
| related_action | VARCHAR(50) | Sí |  |  |  | Acción relacionada (opcional) |
| related_id | VARCHAR(50) | Sí |  |  |  | Id relacionado (opcional) |
| created_at | TIMESTAMP | Sí | NOW() |  |  | Creación |
| read_at | TIMESTAMP | Sí |  |  |  | Leído en |

---

## Tabla: `notifications`
**Descripción**: Notificaciones internas para usuarios.

| Campo | Tipo | Nulo | Default | Clave | Referencia | Descripción |
|---|---|---:|---|---|---|---|
| id | SERIAL | No |  | PK |  | Identificador |
| user_id | INTEGER | No |  | FK | users(id) | Usuario |
| type | VARCHAR(50) | No |  |  |  | Tipo (`GENERAL`, etc.) |
| title | VARCHAR(255) | No |  |  |  | Título |
| message | TEXT | No |  |  |  | Mensaje |
| status | VARCHAR(20) | Sí | PENDING |  |  | Estado (`PENDING`, `READ`, etc.) |
| payload | JSONB | Sí |  |  |  | Datos extra |
| created_at | TIMESTAMP | Sí | NOW() |  |  | Creación |
| updated_at | TIMESTAMP | Sí | NOW() |  |  | Actualización |

---

## Tabla: `barber_breaks`
**Descripción**: Descansos configurables por barbero/día/tipo (desayuno/comida/cena).

| Campo | Tipo | Nulo | Default | Clave | Referencia | Descripción |
|---|---|---:|---|---|---|---|
| id | SERIAL | No |  | PK |  | Identificador |
| barber_id | INTEGER | No |  | FK | users(id) | Barbero |
| day | CHAR(1) | No |  |  |  | Día (`L`,`M`,`X`,`J`,`V`,`S`,`D`) |
| break_type | VARCHAR(20) | No |  |  |  | Tipo (`breakfast`,`lunch`,`dinner`) |
| start_time | TIME | No |  |  |  | Inicio |
| end_time | TIME | No |  |  |  | Fin |
| enabled | BOOLEAN | No | true |  |  | Activo/inactivo |
| created_at | TIMESTAMP | Sí | NOW() |  |  | Creación |
| updated_at | TIMESTAMP | Sí | NOW() |  |  | Actualización |

**Restricciones**:
- `UNIQUE (barber_id, day, break_type)`

---

## Observaciones técnicas
- Existen triggers `update_*_updated_at` que mantienen `updated_at` al actualizar registros.
- Los archivos `schema.sql` en otras carpetas (raíz, supabase, backend/barber-backend) parecen ser variantes/históricos. Este diccionario usa el que ejecuta `backend/src/db/init-db.js`.
