import React from 'react';
import { Database } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <Database className="h-8 w-8 text-primary-600" />
            <h1 className="ml-2 text-xl font-semibold text-gray-800">Bidirectional Data Ingestion Tool</h1>
          </div>
          <div>
            <span className="px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm font-medium">v1.0</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
