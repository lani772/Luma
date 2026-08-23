import { Shield, Trash2, Edit2, Mail, Clock } from 'lucide-react';
import { COLORS } from '@/lib/colors';
import { generateInitials } from '@/lib/utils';

interface UserCardProps {
  id: string;
  fullName: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'guest';
  status: 'active' | 'inactive';
  lastLogin?: string;
  joinedDate?: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

const roleStyles = {
  owner: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  admin: 'bg-red-500/10 text-red-400 border-red-500/20',
  member: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  guest: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const statusStyles = {
  active: 'bg-green-500/10 text-green-400',
  inactive: 'bg-slate-500/10 text-slate-400',
};

export function UserCard({
  fullName,
  email,
  role,
  status,
  lastLogin,
  joinedDate,
  onEdit,
  onDelete,
}: UserCardProps) {
  return (
    <div className="rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/30 p-4 backdrop-blur-sm hover:border-slate-600 hover:shadow-md hover:shadow-slate-800/20 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center font-bold text-white"
            style={{ backgroundColor: COLORS.primaryBlue }}
          >
            {generateInitials(fullName)}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-100">{fullName}</h3>
            <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
              <Mail className="w-3 h-3" />
              {email}
            </div>
          </div>
        </div>

        <div className="flex gap-1">
          {onEdit && (
            <button
              onClick={onEdit}
              aria-label={`Edit ${fullName}`}
              title={`Edit ${fullName}`}
              className="p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Edit2 className="w-4 h-4 text-slate-400 hover:text-slate-200" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              aria-label={`Delete ${fullName}`}
              title={`Delete ${fullName}`}
              className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-400" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {/* Role and Status Badges */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${roleStyles[role]}`}
          >
            <Shield className="w-3 h-3" />
            {role.charAt(0).toUpperCase() + role.slice(1)}
          </span>
          <span
            className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusStyles[status]}`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </div>

        {/* Login and Join Info */}
        <div className="flex flex-col gap-1 pt-2 border-t border-slate-700/30 text-xs text-slate-400">
          {lastLogin && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last login: {lastLogin}
            </div>
          )}
          {joinedDate && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Joined: {joinedDate}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
