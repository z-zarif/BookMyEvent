import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  // Backend now returns a nested user object: { user_id, user_name, email }.
  // Store the whole thing so components can read user.user_name, user.user_id, etc.
  function loginUser(newToken, newUser) {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }

  function logoutUser() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }

  const value = {
    token,
    user,
    userName: user?.user_name,
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
