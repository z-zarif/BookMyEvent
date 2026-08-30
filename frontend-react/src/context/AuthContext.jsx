import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [userName, setUserName] = useState(localStorage.getItem('userName'));

  function loginUser(newToken, newUserName) {
    localStorage.setItem('token', newToken);
    localStorage.setItem('userName', newUserName);
    setToken(newToken);
    setUserName(newUserName);
  }

  function logoutUser() {
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    setToken(null);
    setUserName(null);
  }

  const value = {
    token,
    userName,
    isLoggedIn: !!token,
    loginUser,
    logoutUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Usage in any component: const { isLoggedIn, userName, logoutUser } = useAuth();
export function useAuth() {
  return useContext(AuthContext);
}
