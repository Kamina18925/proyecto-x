# Backend de Proyecto X (Gestión de Administradores)

## Instalación

1. Instala Node.js si no lo tienes: https://nodejs.org/
2. Abre una terminal en la carpeta del proyecto y ejecuta:

   npm install
   npm start

Esto crea la base de datos y el usuario admin inicial:
- Usuario: Kamina
- Contraseña: admin123

## Endpoints principales
- POST /api/login  (body: {username, password})
- POST /api/logout
- GET  /api/admins (solo Kamina)
- POST /api/admins (solo Kamina)
- DELETE /api/admins/:username (solo Kamina)
- GET  /api/whoami

## Seguridad
Solo Kamina puede crear y borrar administradores. Nadie puede autoregistrarse. Puedes cambiar la contraseña inicial en la base de datos.

## Integración
El frontend (HTML) debe llamar a estos endpoints para login y gestión de usuarios.

---

¿Dudas? ¡Pregúntame!
