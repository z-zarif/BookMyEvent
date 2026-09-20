import { createContext, useContext, useState } from 'react';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('adminToken'));

  function login(newToken) {
    localStorage.setItem('adminToken', newToken);
    setToken(newToken);
  }

  function logout() {
    localStorage.removeItem('adminToken');
    setToken(null);
  }

  return (
    <AdminAuthContext.Provider value={{ token, isLoggedIn: !!token, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}
