import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is already logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUserProfile();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUserProfile = async () => {
    try {
      const response = await axios.get('/api/users/profile');
      setUser(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
      logout();
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      setError(null);
      // Usar la ruta del backend que ya maneja login contra la tabla users
      const response = await axios.post('/api/users/login', { email, password });
      const user = response.data; // userController.loginUser devuelve sólo el usuario

      // Para mantener compatibilidad con el resto del código, no usamos token JWT aquí
      setUser(user);
      return user;
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
      throw err;
    }
  };

  const register = async (userData) => {
    try {
      setError(null);
      // Crear usuario usando la ruta /api/users (createUser)
      const response = await axios.post('/api/users', userData);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}