# Stylex - Booking & Business Management System

A modern, full-stack application for managing beauty and personal care businesses (barbershops, salons, etc.), appointments, services, and products.

## Features

- **User Roles**: Client, Professional, and Business Owner
- **Appointment Management**: Book, reschedule, and cancel appointments
- **Service Management**: Manage catalog and professional-specific services
- **Product Management**: Track inventory and sales of products
- **Professional Availability**: Set and manage professional working hours
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
proyecto-x/
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
   git clone https://github.com/Kamina18925/proyecto-x.git
   cd "proyecto-x"
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

- `users`: Stores user information (clients, professionals, owners)
- `barber_shops`: Stores information about businesses
- `services`: Catalog of available services
- `appointments`: Client appointments
- `products`: Products available for sale
- `reviews`: Client reviews

## API Endpoints

The backend provides RESTful API endpoints for all functionality:

- `/api/auth`: Authentication (login, register)
- `/api/users`: User management
- `/api/shops`: Business management
- `/api/services`: Service management
- `/api/appointments`: Appointment booking and management
- `/api/products`: Product management and sales

## Demo Accounts

For testing purposes, the following demo accounts are available:

- **Admin**: admin@stylex.app / Admin123!
- **Owner**: owner@stylex.app / Admin123!
- **Professional**: barber@stylex.app / Barber123!
- **Client**: cliente@stylex.app / Cliente123!

## License

This project is licensed under the MIT License - see the LICENSE file for details.