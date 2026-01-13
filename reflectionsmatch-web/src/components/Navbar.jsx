import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogOut, User as UserIcon } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

const Navbar = ({ user }) => {
    const location = useLocation();

    const isActive = (path) => location.pathname === path;

    return (
        <nav className="bg-indigo-950 text-white shadow-lg">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 items-center">
                    {/* Brand */}
                    <div className="flex-shrink-0 flex items-center">
                        <Link to="/dashboard" className="text-xl font-bold tracking-tight hover:text-indigo-200 transition-colors">
                            Reflections Match
                        </Link>
                    </div>

                    {/* Right Side Actions */}
                    <div className="flex items-center gap-4 md:gap-6">
                        {user && (
                            <>
                                <Link
                                    to="/dashboard"
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive('/dashboard')
                                        ? 'bg-white/10 text-white'
                                        : 'text-indigo-200 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    Dashboard
                                </Link>

                                <Link
                                    to="/radar"
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive('/radar')
                                        ? 'bg-white/10 text-white'
                                        : 'text-indigo-200 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    Radar
                                </Link>

                                <Link
                                    to="/chat"
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive('/chat')
                                        ? 'bg-white/10 text-white'
                                        : 'text-indigo-200 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    Chat
                                </Link>

                                <Link
                                    to="/profile"
                                    className={`flex items-center gap-3 group px-3 py-2 rounded-lg transition-all ${isActive('/profile') ? 'bg-white/10' : 'hover:bg-white/5'
                                        }`}
                                >
                                    <div className="h-8 w-8 rounded-full bg-indigo-700 flex items-center justify-center border border-indigo-500 overflow-hidden">
                                        {user.photoURL ? (
                                            <img src={user.photoURL} alt="Profile" className="h-full w-full object-cover" />
                                        ) : (
                                            <UserIcon size={16} className="text-indigo-200" />
                                        )}
                                    </div>
                                    <span className={`text-sm font-medium hidden md:block ${isActive('/profile') ? 'text-white' : 'text-indigo-100 group-hover:text-white'
                                        }`}>
                                        {user.displayName || 'Profile'}
                                    </span>
                                </Link>

                                <button
                                    onClick={() => signOut(auth)}
                                    className="text-indigo-300 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
                                    title="Sign Out"
                                >
                                    <LogOut size={20} />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
