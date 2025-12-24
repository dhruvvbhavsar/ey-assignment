import { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import {
  Home,
  User,
  LogOut,
  Menu,
  X,
  Wifi,
  WifiOff,
  Bell,
} from 'lucide-react';

function Layout() {
  const { user, logout } = useAuth();
  const { isConnected } = useWebSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">T</span>
              </div>
              <span className="text-xl font-bold text-gray-900 hidden sm:block">
                Twitter Lite
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
                      isActive(item.path)
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right side items */}
            <div className="flex items-center gap-3">
              {/* Connection status indicator */}
              <div
                className={`p-2 rounded-full ${
                  isConnected
                    ? 'text-green-500 bg-green-50'
                    : 'text-gray-400 bg-gray-100'
                }`}
                title={isConnected ? 'Connected' : 'Disconnected'}
              >
                {isConnected ? <Wifi size={18} /> : <WifiOff size={18} />}
              </div>

              {/* User menu - Desktop */}
              <div className="hidden md:flex items-center gap-3">
                <Link
                  to="/profile"
                  className="flex items-center gap-2 hover:bg-gray-100 rounded-full px-3 py-1.5 transition-colors"
                >
                  {user?.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.display_name || user.username}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-primary-700 font-medium text-sm">
                        {(user?.display_name || user?.username || 'U')[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="font-medium text-gray-700 max-w-[100px] truncate">
                    {user?.display_name || user?.username}
                  </span>
                </Link>

                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  title="Logout"
                >
                  <LogOut size={20} />
                </button>
              </div>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <nav className="px-4 py-2 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive(item.path)
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}

              {/* User info and logout in mobile menu */}
              <div className="border-t border-gray-200 pt-2 mt-2">
                <div className="flex items-center gap-3 px-4 py-3">
                  {user?.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.display_name || user.username}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-primary-700 font-bold">
                        {(user?.display_name || user?.username || 'U')[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {user?.display_name || user?.username}
                    </p>
                    <p className="text-sm text-gray-500 truncate">@{user?.username}</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-3 px-4 py-3 w-full text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogOut size={20} />
                  <span className="font-medium">Logout</span>
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Outlet />
      </main>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-colors ${
                  isActive(item.path)
                    ? 'text-primary-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon size={24} />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Spacer for mobile bottom nav */}
      <div className="md:hidden h-20" />
    </div>
  );
}

export default Layout;
