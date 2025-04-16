import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white">
      <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} Data Ingestion Tool. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
