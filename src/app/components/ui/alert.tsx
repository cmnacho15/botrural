import React from 'react'

export function Alert({ 
  children, 
  variant = 'default',
  className = '' 
}: { 
  children: React.ReactNode
  variant?: 'default' | 'destructive'
  className?: string 
}) {
  const variantClasses = {
    default: 'bg-blue-50 border-blue-200 text-blue-900',
    destructive: 'bg-red-50 border-red-200 text-red-900',
  }
  
  return (
    <div className={`border rounded-lg p-4 flex items-start gap-3 ${variantClasses[variant]} ${className}`}>
      {children}
    </div>
  )
}

export function AlertDescription({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`text-sm ${className}`}>
      {children}
    </div>
  )
}