import React from 'react';

export default function StatCard({ title, value, subtitle, icon: Icon, trend, variant = 'teal' }) {
  const variantStyles = {
    teal: 'bg-teal-50 text-teal-700 border-teal-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200'
  };

  return (
    <div className="enterprise-card p-5 flex items-start justify-between">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
          {title}
        </span>
        <div className="text-2xl font-bold text-slate-900 tracking-tight">
          {value}
        </div>
        {subtitle && (
          <span className="text-xs text-slate-500 font-medium block mt-1">
            {subtitle}
          </span>
        )}
      </div>
      {Icon && (
        <div className={`p-3 rounded-xl border ${variantStyles[variant] || variantStyles.teal}`}>
          <Icon className="w-5 h-5" />
        </div>
      )}
    </div>
  );
}

