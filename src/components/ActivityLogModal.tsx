import React, { useState, useEffect } from 'react';
import { 
  X, 
  Activity, 
  Trash2, 
  Send, 
  Sparkles, 
  ArrowDownToLine, 
  Tag, 
  Download, 
  Upload, 
  Zap, 
  ShieldCheck 
} from 'lucide-react';
import { ActivityService, type ActivityItem } from '../services/activityService';

interface ActivityLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ActivityLogModal: React.FC<ActivityLogModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    return ActivityService.subscribe(setActivities);
  }, []);

  if (!isOpen) return null;

  const getTypeIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'generate':
        return <Sparkles className="w-4 h-4 text-[#0098EA]" />;
      case 'send':
      case 'distribute':
        return <Send className="w-4 h-4 text-emerald-400" />;
      case 'sweep':
        return <ArrowDownToLine className="w-4 h-4 text-blue-400" />;
      case 'tag':
        return <Tag className="w-4 h-4 text-purple-400" />;
      case 'export':
        return <Download className="w-4 h-4 text-amber-400" />;
      case 'import':
        return <Upload className="w-4 h-4 text-indigo-400" />;
      case 'faucet':
        return <Zap className="w-4 h-4 text-yellow-400" />;
      case 'security':
        return <ShieldCheck className="w-4 h-4 text-pink-400" />;
      default:
        return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fadeIn">
      <div className="glass-card max-w-2xl w-full p-6 border border-white/20 shadow-2xl relative space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Activity Log & Audit Trail</h2>
              <p className="text-xs text-gray-400">Complete chronological ledger of wallet operations and mass transactions</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => ActivityService.clear()}
              className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-white/5"
              title="Clear History"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* List of Activities */}
        <div className="max-h-96 overflow-y-auto space-y-2 divide-y divide-white/5">
          {activities.length === 0 ? (
            <div className="p-10 text-center text-xs text-gray-500">
              No recent studio activity recorded yet.
            </div>
          ) : (
            activities.map(item => (
              <div key={item.id} className="p-3 bg-[#080d1a] rounded-xl border border-white/5 flex items-start justify-between gap-3 text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#121b30] flex items-center justify-center shrink-0 mt-0.5">
                    {getTypeIcon(item.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{item.title}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        item.status === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="text-gray-300 text-xs mt-0.5">{item.description}</p>
                    {item.amount && (
                      <span className="inline-block mt-1 font-mono font-bold text-emerald-400 text-xs">
                        Amount: {item.amount} {item.token || 'TON'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono text-[11px] text-gray-500">
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="block text-[10px] text-gray-600">
                    {new Date(item.timestamp).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
};
