# BarberRD - Barber Shop Management System

A modern, full-stack application for managing barber shops, appointments, services, and products.

## Features

- **User Roles**: Client, Barber, and Shop Owner
- **Appointment Management**: Book, reschedule, and cancel appointments
- **Service Management**: Manage catalog and barber-specific services
- **Product Management**: Track inventory and sales of products
- **Barber Availability**: Set and manage barber working hours
- **Reviews and Ratings**: Allow clients to rate and review services

## Tech Stack

### Frontend
- React.js with Vite
- React Router for navigation
- Tailwind CSS for styling
- Axios for API requests

### Backend
- Node.js with Express
- PostgreSQL database
- JWT for authentication
- RESTful API architecture

## Project Structure

```
barber-app/
├── frontend/             # React frontend application
│   ├── public/           # Static assets
│   └── src/              # Source code
│       ├── components/   # Reusable UI components
│       ├── contexts/     # React contexts (auth, etc.)
│       ├── layouts/      # Page layouts
│       └── pages/        # Application pages
├── backend/              # Node.js backend application
│   ├── src/              # Source code
│       ├── db/           # Database connection and models
│       ├── middleware/   # Express middleware
│       └── routes/       # API routes
└── README.md             # Project documentation
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/barber-app.git
   cd barber-app
   ```

2. Install dependencies:
   ```
   npm run install:all
   ```

3. Set up environment variables:
   - Create a `.env` file in the root directory based on the provided example

4. Set up the database:
   ```
   cd backend
   npm run seed
   ```

5. Start the development servers:
   ```
   npm run dev
   ```

## Database Schema

The application uses a PostgreSQL database with the following main tables:

- `users`: Stores user information (clients, barbers, owners)
- `barbershops`: Stores information about barber shops
- `masterservices`: Catalog of available services
- `barberservices`: Barber-specific service configurations
- `appointments`: Client appointments
- `barberavailability`: Barber working hours
- `products`: Products available for sale
- `productsales`: Record of product sales
- `reviews`: Client reviews for shops and services

## API Endpoints

The backend provides RESTful API endpoints for all functionality:

- `/api/auth`: Authentication (login, register)
- `/api/users`: User management
- `/api/shops`: Barber shop management
- `/api/services`: Service management
- `/api/appointments`: Appointment booking and management
- `/api/products`: Product management and sales

## Demo Accounts

For testing purposes, the following demo accounts are available:

- **Client**: client@example.com / password123
- **Barber**: barber@example.com / password123
- **Owner**: owner@example.com / password123

## License

This project is licensed under the MIT License - see the LICENSE file for details.