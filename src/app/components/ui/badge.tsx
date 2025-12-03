import React from 'react'

export function Badge({ 
  children, 
  variant = 'default',
  className = '' 
}: { 
  children: React.ReactNode
  variant?: 'default' | 'secondary' | 'destructive'
  className?: string 
}) {
  const variantClasses = {
    default: 'bg-blue-100 text-blue-800',
    secondary: 'bg-gray-100 text-gray-800',
    destructive: 'bg-red-100 text-red-800',
  }
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  )
}