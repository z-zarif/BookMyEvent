import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

// JWTs are just base64 underneath - no library needed to peek at the role.
function decodeRole(token) {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role || 'user';
  } catch {
    return 'user';
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [role, setRole] = useState(() => decodeRole(localStorage.getItem('token')));

  function loginUser(newToken, newUser) {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setRole(decodeRole(newToken));
  }

  // Used after becoming an organizer: same user, new token carrying the new role.
  function refreshToken(newToken) {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setRole(decodeRole(newToken));
  }

  function logoutUser() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setRole(null);
  }

  const value = {
    token,
    user,
    userName: user?.user_name,
    role,
    isOrganizer: role === 'organizer',
    isLoggedIn: !!token,
    loginUser,
    refreshToken,
    logoutUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Usage in any component: const { isLoggedIn, isOrganizer, userName, logoutUser } = useAuth();
export function useAuth() {
  return useContext(AuthContext);
}
