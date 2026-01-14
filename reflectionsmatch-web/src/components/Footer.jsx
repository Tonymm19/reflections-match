import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
    return (
        <footer className="bg-white border-t border-gray-200 mt-auto">
            <div className="max-w-6xl mx-auto px-6 py-8 md:py-12">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    {/* Copyright */}
                    <div className="text-gray-500 text-sm font-medium">
                        &copy; 2026 Reflections Match. All rights reserved.
                    </div>

                    {/* Links */}
                    <div className="flex flex-wrap justify-center gap-6 md:gap-8">
                        <Link to="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                            Privacy Policy
                        </Link>
                        <Link to="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                            Terms & Conditions
                        </Link>
                        <Link to="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                            Cookie Preferences
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
