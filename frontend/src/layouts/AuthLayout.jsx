import { Outlet } from 'react-router-dom';

const AuthLayout = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-extrabold text-gray-800 tracking-tight">
            Barber<span className="text-indigo-600">RD</span>
          </h1>
          <p className="mt-2 text-gray-600">Professional Barber Shop Management</p>
        </div>
        <Outlet />
        <p className="mt-10 text-center text-xs text-gray-500">
          &copy; {new Date().getFullYear()} BarberRD. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default AuthLayout;