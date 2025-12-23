import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  // For demo purposes
  const [demoRole, setDemoRole] = useState('client');
  const demoUsers = {
    client: { email: 'client@example.com', password: 'password123' },
    barber: { email: 'barber@example.com', password: 'password123' },
    owner: { email: 'owner@example.com', password: 'password123' }
  };

  const handleDemoLogin = () => {
    const user = demoUsers[demoRole];
    setEmail(user.email);
    setPassword(user.password);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to login. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white py-8 px-6 shadow-2xl rounded-xl sm:px-10">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 text-sm">
            {error}
          </div>
        )}
        
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <div className="mt-1">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="your@email.com"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <div className="mt-1">
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="••••••••"
            />
          </div>
        </div>

        <div className="pt-2">
          <p className="text-xs text-center text-gray-500 mb-2">--- For Demo Purposes ---</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="role-selector-demo" className="block text-xs font-medium text-gray-600">Role</label>
              <select 
                id="role-selector-demo" 
                value={demoRole} 
                onChange={(e) => setDemoRole(e.target.value)} 
                className="mt-1 block w-full pl-3 pr-8 py-2 text-xs border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md shadow-sm"
              >
                <option value="client">Client</option>
                <option value="barber">Barber</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleDemoLogin}
                className="w-full py-2 px-3 text-xs bg-gray-200 hover:bg-gray-300 rounded-md"
              >
                Fill Demo Credentials
              </button>
            </div>
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 transition-colors"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </div>
      </form>

      <div className="mt-6 text-sm text-center space-x-2">
        <Link to="/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500 hover:underline">
          Forgot your password?
        </Link>
        <span className="text-gray-300">|</span>
        <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-500 hover:underline">
          Create account
        </Link>
      </div>
    </div>
  );
};

export default Login;