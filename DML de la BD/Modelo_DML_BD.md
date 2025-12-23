# Modelo (DML) de la Base de Datos — Proyecto X

## Fuente del esquema
Este modelo se generó a partir de:

- `backend/src/db/schema.sql`
- `backend/src/db/barber_breaks.sql`

Si tu BD productiva difiere (por ejemplo, si usas scripts de `supabase/migrations` u otro `schema.sql`), dímelo y lo regenero.

## Convenciones
- **PK**: Primary Key
- **FK**: Foreign Key
- **UK**: Unique Key

## Diagrama Entidad–Relación (ER)

```mermaid
erDiagram
  BARBER_SHOPS ||--o{ USERS : "fk_users_shop"
  USERS ||--o{ BARBER_SHOPS : "fk_barber_shops_owner"

  BARBER_SHOPS ||--o{ SERVICES : "fk_services_shop"

  USERS ||--o{ APPOINTMENTS : "fk_appointments_client"
  USERS ||--o{ APPOINTMENTS : "fk_appointments_barber"
  BARBER_SHOPS ||--o{ APPOINTMENTS : "fk_appointments_shop"
  SERVICES ||--o{ APPOINTMENTS : "fk_appointments_service"

  APPOINTMENTS ||--o{ APPOINTMENT_NOTES : "fk_appointment_notes_appointment"
  APPOINTMENTS ||--o{ APPOINTMENT_EXTRAS : "fk_appointment_extras_appointment"
  SERVICES ||--o{ APPOINTMENT_EXTRAS : "fk_appointment_extras_service"
  APPOINTMENTS ||--o{ APPOINTMENT_STATUS_HISTORY : "fk_appointment_status_history_appointment"

  USERS ||--o{ SESSIONS : "sessions_user_id"

  USERS ||--o{ REVIEWS : "fk_reviews_user"
  BARBER_SHOPS ||--o{ REVIEWS : "fk_reviews_shop"

  USERS ||--o{ CONVERSATIONS : "client_id"
  USERS ||--o{ CONVERSATIONS : "barber_id"
  USERS ||--o{ CONVERSATIONS : "owner_id"
  APPOINTMENTS ||--o{ CONVERSATIONS : "appointment_id"

  CONVERSATIONS ||--o{ MESSAGES : "fk_messages_conversation"
  USERS ||--o{ MESSAGES : "fk_messages_sender"
  USERS ||--o{ MESSAGES : "fk_messages_receiver"

  USERS ||--o{ NOTIFICATIONS : "fk_notifications_user"

  USERS ||--o{ BARBER_BREAKS : "barber_id"
```

## Relación y cardinalidad (resumen)
- **barber_shops** 1—N **users** (por `users.shop_id`)
- **users** (owner) 1—N **barber_shops** (por `barber_shops.owner_id`)
- **barber_shops** 1—N **services**
- **appointments** relaciona **client** (users) + **barber** (users) + **shop** + **service**
- **appointments** 1—N **appointment_notes**, **appointment_extras**, **appointment_status_history**
- **conversations** relaciona participantes y opcionalmente una cita
- **messages** pertenece a una conversación
- **notifications** pertenece a un usuario
- **barber_breaks** pertenece a un barbero (usuario)

## Reglas/constraints relevantes
- **No doble slot para el mismo barbero**: `appointments` tiene `UNIQUE (barber_id, date)`.
- **Breaks (descansos) únicos por día/tipo**: `barber_breaks` tiene `UNIQUE (barber_id, day, break_type)`.

## Enumeraciones / valores esperados
- `users.role`: `'barber' | 'client' | 'owner'`
- `appointments.status`: típicamente `'confirmed' | 'completed' | 'cancelled' | 'no-show'` (y otros estados que el frontend pueda manejar)
- `barber_breaks.day`: `'L','M','X','J','V','S','D'`
- `barber_breaks.break_type`: `'breakfast' | 'lunch' | 'dinner'`

## Objetos principales por módulo
- **Autenticación**: `users`, `sessions`
- **Core booking**: `appointments`, `services`, `barber_shops`
- **Productos**: `products`
- **Reseñas**: `reviews`
- **Mensajería interna**: `conversations`, `messages`, `notifications`
- **Disponibilidad/descansos**: `barber_breaks`
