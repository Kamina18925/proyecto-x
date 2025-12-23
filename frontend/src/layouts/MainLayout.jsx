import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';
import { FaBars, FaTimes, FaUser, FaSignOutAlt } from 'react-icons/fa';

const MainLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getNavLinks = () => {
    if (user?.role === 'client') {
      return [
        { to: '/dashboard', label: 'Dashboard' },
        { to: '/barbershops', label: 'Find Barber Shops' },
        { to: '/appointments', label: 'My Appointments' },
      ];
    } else if (user?.role === 'barber') {
      return [
        { to: '/dashboard', label: 'Dashboard' },
        { to: '/barber/appointments', label: 'Appointments' },
        { to: '/barber/services', label: 'My Services' },
        { to: '/barber/availability', label: 'Availability' },
        { to: '/barber/products', label: 'My Products' },
      ];
    } else if (user?.role === 'owner') {
      return [
        { to: '/dashboard', label: 'Dashboard' },
        { to: '/owner/shops', label: 'My Shops' },
        { to: '/owner/services', label: 'Services' },
        { to: '/owner/barbers', label: 'Barbers' },
        { to: '/owner/appointments', label: 'Appointments' },
        { to: '/owner/products', label: 'Products' },
      ];
    }
    return [];
  };

  const navLinks = getNavLinks();

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-100">
      {/* Mobile Header */}
      <div className="md:hidden bg-indigo-800 text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">BarberRD</h1>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2">
          {sidebarOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'block' : 'hidden'} md:block md:w-64 bg-indigo-800 text-white p-6 space-y-6 min-h-screen`}>
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold">BarberRD</h1>
          <p className="text-xs text-indigo-300 mt-1">Professional Barber Shop</p>
        </div>

        <div className="flex flex-col space-y-1">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-medium flex items-center transition-colors ${
                  isActive
                    ? 'bg-indigo-700 text-white'
                    : 'text-indigo-100 hover:bg-indigo-700 hover:text-white'
                }`
              }
              onClick={() => setSidebarOpen(false)}
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="pt-6 mt-auto border-t border-indigo-700">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center">
              <FaUser className="text-white" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-white">{user?.name}</p>
              <p className="text-xs text-indigo-300">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 rounded-lg text-sm font-medium flex items-center text-indigo-100 hover:bg-red-700 hover:text-white transition-colors"
          >
            <FaSignOutAlt className="mr-2" />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 md:p-8 lg:p-10 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
};

export default MainLayout;