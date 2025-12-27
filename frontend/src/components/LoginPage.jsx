import React, { useState, useContext } from 'react';
import { AppContext } from '../App';
import Modal from './Modal';
import Notification from './Notification';
import { userApi } from '../services/apiService';

// Formulario de registro
const RegistrationForm = ({ onRegistered }) => {
  const { dispatch, state } = useContext(AppContext);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('client');
  const [gender, setGender] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim() || !password.trim() || !confirmPassword.trim()) {
      dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: 'Todos los campos son requeridos.', type: 'error' } });
      return;
    }
    if (password !== confirmPassword) {
      dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: 'Las contraseñas no coinciden.', type: 'error' } });
      return;
    }
    const phoneRegex = /^[0-9]{3}-?[0-9]{3}-?[0-9]{4}$/;
    if (!phoneRegex.test(phone)) {
      dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: 'Formato de teléfono inválido. Use 809-XXX-XXXX o similar.', type: 'error' } });
      return;
    }
    if (!role) {
      dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: 'Debes seleccionar el tipo de cuenta.', type: 'error' } });
      return;
    }
    
    setLoading(true);
    
    try {
      dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: 'Registrando usuario...', type: 'info' } });
      
      // Usar la API para registrar al usuario
      const userData = {
        nombre: name,
        email: email,
        telefono: phone,
        password: password,
        rol: role,
        ...(gender ? { gender } : {})
      };
      
      const response = await userApi.register(userData);
      
      // Si llegamos aquí, el registro fue exitoso
      dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: 'Usuario registrado exitosamente.', type: 'success' } });
      onRegistered();
    } catch (error) {
      console.error('Error en registro:', error);
      dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: error.message || 'Error al registrar usuario.', type: 'error' } });
    } finally {
      setLoading(false);
    }
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <span className="block text-sm font-medium text-slate-700 mb-1">Tipo de cuenta</span>
        <div className="flex flex-col sm:flex-row gap-2">
          <label className="flex items-center text-sm text-slate-700 cursor-pointer">
            <input
              type="radio"
              name="role"
              value="client"
              checked={role === 'client'}
              onChange={e => setRole(e.target.value)}
              className="h-4 w-4 text-indigo-600 border-slate-300 focus:ring-indigo-500 mr-2"
            />
            Cliente
          </label>
          <label className="flex items-center text-sm text-slate-700 cursor-pointer">
            <input
              type="radio"
              name="role"
              value="barber"
              checked={role === 'barber'}
              onChange={e => setRole(e.target.value)}
              className="h-4 w-4 text-indigo-600 border-slate-300 focus:ring-indigo-500 mr-2"
            />
            Profesional
          </label>
          <label className="flex items-center text-sm text-slate-700 cursor-pointer">
            <input
              type="radio"
              name="role"
              value="owner"
              checked={role === 'owner'}
              onChange={e => setRole(e.target.value)}
              className="h-4 w-4 text-indigo-600 border-slate-300 focus:ring-indigo-500 mr-2"
            />
            Dueño de barbería
          </label>
        </div>
        <p className="mt-1 text-xs text-slate-500">Más adelante podrás completar los datos de tu barbería o unirte a una existente.</p>
      </div>
      <div>
        <label htmlFor="reg_name" className="block text-sm font-medium text-slate-700">Nombre Completo</label>
        <input id="reg_name" name="name" type="text" required value={name} onChange={e => setName(e.target.value)} className="mt-1 block w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Tu Nombre Completo" />
      </div>
      <div>
        <label htmlFor="reg_email" className="block text-sm font-medium text-slate-700">Email</label>
        <input id="reg_email" name="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="tu@email.com" />
      </div>
      <div>
        <label htmlFor="reg_phone" className="block text-sm font-medium text-slate-700">Teléfono</label>
        <input id="reg_phone" name="phone" type="tel" autoComplete="tel" required value={phone} onChange={e => setPhone(e.target.value)} className="mt-1 block w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="809-123-4567" />
      </div>
      <div>
        <label htmlFor="reg_gender" className="block text-sm font-medium text-slate-700">Género (opcional)</label>
        <select
          id="reg_gender"
          name="gender"
          value={gender}
          onChange={e => setGender(e.target.value)}
          className="mt-1 block w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
        >
          <option value="">Prefiero no decir</option>
          <option value="male">Masculino</option>
          <option value="female">Femenino</option>
          <option value="other">Otro</option>
        </select>
      </div>
      <div>
        <label htmlFor="reg_password" className="block text-sm font-medium text-slate-700">Contraseña</label>
        <input id="reg_password" name="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 block w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="••••••••" />
      </div>
      <div>
        <label htmlFor="reg_confirm_password" className="block text-sm font-medium text-slate-700">Confirmar Contraseña</label>
        <input id="reg_confirm_password" name="confirm_password" type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="mt-1 block w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="••••••••" />
      </div>
      <div className="flex justify-end space-x-3 pt-3">
        <button type="button" onClick={onRegistered} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 shadow-sm transition-colors">Cancelar</button>
        <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">{loading ? 'Registrando...' : 'Registrarme'}</button>
      </div>
    </form>
  );
};

// Formulario de recuperación de contraseña
const ForgotPasswordForm = ({ onSent }) => {
  const { dispatch } = useContext(AppContext);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: 'Por favor, ingresa tu email.', type: 'error' } });
      return;
    }
    
    setLoading(true);
    
    try {
      // Llamar a la API para solicitar restablecimiento de contraseña
      await userApi.forgotPassword({ email });
      
      // Mostrar mensaje de éxito
      dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: `Si existe una cuenta para ${email}, recibirás un enlace de recuperación.`, type: 'info' } });
      onSent();
    } catch (error) {
      console.error('Error al solicitar recuperación de contraseña:', error);
      dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: 'Hubo un problema al procesar tu solicitud.', type: 'error' } });
    } finally {
      setLoading(false);
    }
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="fp_email" className="block text-sm font-medium text-slate-700">Email Registrado</label>
        <input id="fp_email" name="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="tu@email.com" />
      </div>
      <div className="flex justify-end space-x-3 pt-3">
        <button type="button" onClick={onSent} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 shadow-sm transition-colors">Cancelar</button>
        <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">{loading ? 'Enviando...' : 'Enviar Enlace'}</button>
      </div>
    </form>
  );
};

const LoginPage = () => {
  const { state, dispatch } = useContext(AppContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Espacio para funciones adicionales en el futuro

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Usar la API para autenticar al usuario
      const userData = await userApi.login({ email, password });
      
      console.log('LoginPage: Datos de usuario recibidos de la API:', userData);
      
      // Compatibilidad con nombres de campos en español e inglés
      const userRole = userData.rol || userData.role || '';
      const userName = userData.nombre || userData.name || 'Usuario';
      
      console.log('LoginPage: Rol detectado:', userRole);
      
      // NO establecer initialView aquí - lo haremos en el reducer para centralizar la lógica
      // Solo enviar los datos del usuario al store
      dispatch({ type: 'LOGIN', payload: userData });
      
      // El mensaje de bienvenida también se maneja en el reducer
      // para evitar duplicar notificaciones
    } catch (error) {
      console.error('Error en login:', error);
      dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: 'Credenciales no válidas.', type: 'error' } });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center login-page-bg p-4 sm:p-6 lg:p-8">
      {state.notification && (
        <Notification message={state.notification.message} type={state.notification.type} id={state.notification.id} />
      )}
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-extrabold text-slate-800 tracking-tight">Style<span className="text-indigo-600">x</span></h1>
        </div>
        <div className="bg-white py-8 px-6 shadow-2xl rounded-xl sm:px-10">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="email_login" className="sr-only">Email</label>
              <input id="email_login" name="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className="appearance-none block w-full pl-3 pr-3 py-2.5 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="tu@email.com" />
            </div>
            <div>
              <label htmlFor="password_login" className="sr-only">Contraseña</label>
              <input id="password_login" name="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="appearance-none block w-full pl-3 pr-3 py-2.5 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="••••••••" />
            </div>
            <div className="pt-2"></div>
            <div>
              <button type="submit" className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 transition-colors">Iniciar Sesión</button>
            </div>
          </form>
          <div className="mt-6 text-sm text-center space-x-2">
            <a href="#" onClick={e => { e.preventDefault(); setShowForgotPassword(true); }} className="font-medium text-indigo-600 hover:text-indigo-500 hover:underline">¿Olvidaste tu contraseña?</a>
            <span className="text-slate-300">|</span>
            <a href="#" onClick={e => { e.preventDefault(); setShowRegistration(true); }} className="font-medium text-indigo-600 hover:text-indigo-500 hover:underline">Crear cuenta</a>
          </div>
        </div>
        <p className="mt-10 text-center text-xs text-slate-500">&copy; {new Date().getFullYear()} Stylex. Todos los derechos reservados.</p>
      </div>
      {/* Modal de registro */}
      {showRegistration && (
        <Modal title="Crear Nueva Cuenta" isOpen={showRegistration} onClose={() => setShowRegistration(false)}>
          <RegistrationForm onRegistered={() => setShowRegistration(false)} />
        </Modal>
      )}
      {/* Modal de recuperación de contraseña */}
      {showForgotPassword && (
        <Modal title="Recuperar Contraseña" isOpen={showForgotPassword} onClose={() => setShowForgotPassword(false)}>
          <ForgotPasswordForm onSent={() => setShowForgotPassword(false)} />
        </Modal>
      )}

    </div>
  );
};

export default LoginPage;
