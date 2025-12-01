import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  label: string;
}

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', label, className = '', ...props }) => {
  const baseStyles = "px-8 py-3 rounded uppercase tracking-widest font-bold transition-all duration-200 transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black";
  
  const variants = {
    primary: "bg-cyan-500 text-black hover:bg-cyan-400 hover:shadow-[0_0_20px_rgba(6,182,212,0.7)] focus:ring-cyan-500",
    secondary: "border-2 border-cyan-500 text-cyan-500 hover:bg-cyan-900/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.4)] focus:ring-cyan-500",
    danger: "bg-red-600 text-black hover:bg-red-500 hover:shadow-[0_0_20px_rgba(220,38,38,0.7)] focus:ring-red-600",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {label}
    </button>
  );
};
