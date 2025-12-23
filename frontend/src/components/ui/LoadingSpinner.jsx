const LoadingSpinner = ({ size = 'md', color = 'indigo' }) => {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-3',
    xl: 'h-16 w-16 border-4'
  };

  const colorClasses = {
    indigo: 'border-indigo-600',
    blue: 'border-blue-600',
    green: 'border-green-600',
    red: 'border-red-600',
    gray: 'border-gray-600',
    white: 'border-white'
  };

  return (
    <div className="flex justify-center items-center">
      <div className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full animate-spin border-t-transparent`}></div>
    </div>
  );
};

export default LoadingSpinner;