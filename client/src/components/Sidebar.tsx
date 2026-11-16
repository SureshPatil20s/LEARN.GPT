'use client';

import React, { useState, useEffect } from 'react';
import { Conversation } from '@/types';
import { useAuth } from '@/context/AuthContext';
import {
  MessageSquare,
  Plus,
  Pin,
  Trash2,
  Edit2,
  Check,
  X,
  Search,
  LogOut,
  LogIn,
  Settings,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Database,
} from 'lucide-react';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onTogglePin: (id: string, isPinned: boolean) => void;
  onOpenDocuments: () => void;
  onOpenSettings?: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export default function Sidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  onTogglePin,
  onOpenDocuments,
  onOpenSettings,
  isOpen,
  onToggleOpen,
}: SidebarProps) {
  const { user, logout, setAuthModalOpen } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [mountedTime, setMountedTime] = useState<number | null>(null);

  useEffect(() => {
    setMountedTime(Date.now());
  }, []);

  // Chronological Chat Grouping
  const chatGroups = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = q ? conversations.filter((c) => c.title.toLowerCase().includes(q)) : conversations;

    const groups = {
      pinned: [] as Conversation[],
      today: [] as Conversation[],
      yesterday: [] as Conversation[],
      last7Days: [] as Conversation[],
      last30Days: [] as Conversation[],
      older: [] as Conversation[],
    };

    if (!mountedTime) {
      for (const c of list) {
        if (c.is_pinned) groups.pinned.push(c);
        else groups.today.push(c);
      }
      return groups;
    }

    const now = new Date(mountedTime);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;
    const startOf7Days = startOfToday - 6 * 86400000;
    const startOf30Days = startOfToday - 29 * 86400000;

    for (const c of list) {
      if (c.is_pinned) {
        groups.pinned.push(c);
        continue;
      }
      const time = new Date(c.updated_at || c.created_at).getTime();
      if (time >= startOfToday) {
        groups.today.push(c);
      } else if (time >= startOfYesterday) {
        groups.yesterday.push(c);
      } else if (time >= startOf7Days) {
        groups.last7Days.push(c);
      } else if (time >= startOf30Days) {
        groups.last30Days.push(c);
      } else {
        groups.older.push(c);
      }
    }

    return groups;
  }, [conversations, searchQuery, mountedTime]);

  const handleStartRename = (c: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(c.id);
    setEditTitle(c.title);
  };

  const handleSaveRename = (c: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      onRenameConversation(c.id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const renderConversationItem = (c: Conversation) => {
    const isActive = c.id === activeConversationId;
    const isEditing = c.id === editingId;

    return (
      <div
        key={c.id}
        onClick={() => onSelectConversation(c.id)}
        className={`group relative flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer text-sm transition-all duration-150 ${
          isActive
            ? 'bg-zinc-200 dark:bg-[#212121] text-zinc-900 dark:text-white font-medium shadow-xs'
            : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-[#1a1a1a] hover:text-zinc-900 dark:hover:text-zinc-200'
        }`}
      >
        <MessageSquare className="w-4 h-4 shrink-0 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300" />
        
        {isEditing ? (
          <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveRename(c, e as any);
                if (e.key === 'Escape') setEditingId(null);
              }}
              autoFocus
              className="w-full bg-white dark:bg-[#111] border border-zinc-300 dark:border-zinc-700 rounded px-2 py-0.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={(e) => handleSaveRename(c, e)}
              className="p-1 hover:text-emerald-500 text-zinc-400"
              title="Save"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleCancelRename}
              className="p-1 hover:text-rose-500 text-zinc-400"
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <>
            <span className="truncate flex-1">{c.title}</span>
            <div className="hidden group-hover:flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin(c.id, !c.is_pinned);
                }}
                className={`p-1 rounded hover:bg-zinc-300 dark:hover:bg-zinc-800 ${
                  c.is_pinned ? 'text-amber-500 dark:text-amber-400' : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
                title={c.is_pinned ? 'Unpin chat' : 'Pin chat'}
              >
                <Pin className="w-3.5 h-3.5 fill-current" />
              </button>
              <button
                onClick={(e) => handleStartRename(c, e)}
                className="p-1 rounded hover:bg-zinc-300 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                title="Rename chat"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Delete this conversation?')) {
                    onDeleteConversation(c.id);
                  }
                }}
                className="p-1 rounded hover:bg-zinc-300 dark:hover:bg-zinc-800 text-zinc-400 hover:text-rose-500"
                title="Delete chat"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onToggleOpen}
          className="md:hidden fixed inset-0 bg-black/60 z-30 backdrop-blur-xs"
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 flex flex-col w-64 bg-zinc-50 dark:bg-[#0e0e0e] border-r border-zinc-200 dark:border-[#212121] transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* App Title & New Chat */}
        <div className="p-3 border-b border-zinc-200 dark:border-[#212121] flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-linear-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-black font-black text-sm shadow-md">
                L
              </div>
              <span className="font-semibold text-zinc-900 dark:text-white tracking-wide text-sm flex items-center gap-1.5">
                LEARN.GPT
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/60">
                  Pro
                </span>
              </span>
            </div>
            <button
              onClick={onToggleOpen}
              className="md:hidden p-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700/80 text-white font-medium text-sm transition-all shadow-xs group"
          >
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>New chat</span>
            </div>
            <kbd className="hidden group-hover:inline-block text-[10px] text-zinc-400 bg-zinc-800 dark:bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-700">
              Ctrl+K
            </kbd>
          </button>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-[#181818] border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 pl-8 pr-3 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500 dark:focus:border-zinc-600 transition"
            />
          </div>
        </div>

        {/* Knowledge Base Shortcut */}
        <div className="px-3 py-2 border-b border-zinc-200 dark:border-[#212121]">
          <button
            onClick={onOpenDocuments}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40 hover:border-emerald-300 dark:hover:border-emerald-700 transition"
          >
            <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="flex flex-col text-left">
              <span>Knowledge Base (RAG)</span>
              <span className="text-[10px] text-emerald-600/80 dark:text-emerald-500/70 font-normal">PDF, DOCX, TXT, CSV, JSON</span>
            </div>
          </button>
        </div>

        {/* Conversation List with Chronological Grouping */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3.5 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-800">
          {/* Pinned Group */}
          {chatGroups.pinned.length > 0 && (
            <div>
              <div className="px-3 pb-1 text-[11px] font-semibold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                <Pin className="w-3 h-3 fill-current" />
                <span>Pinned</span>
              </div>
              <div className="space-y-0.5">
                {chatGroups.pinned.map(renderConversationItem)}
              </div>
            </div>
          )}

          {/* Today Group */}
          {chatGroups.today.length > 0 && (
            <div>
              <div className="px-3 pb-1 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                Today
              </div>
              <div className="space-y-0.5">
                {chatGroups.today.map(renderConversationItem)}
              </div>
            </div>
          )}

          {/* Yesterday Group */}
          {chatGroups.yesterday.length > 0 && (
            <div>
              <div className="px-3 pb-1 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                Yesterday
              </div>
              <div className="space-y-0.5">
                {chatGroups.yesterday.map(renderConversationItem)}
              </div>
            </div>
          )}

          {/* Previous 7 Days Group */}
          {chatGroups.last7Days.length > 0 && (
            <div>
              <div className="px-3 pb-1 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                Previous 7 Days
              </div>
              <div className="space-y-0.5">
                {chatGroups.last7Days.map(renderConversationItem)}
              </div>
            </div>
          )}

          {/* Previous 30 Days Group */}
          {chatGroups.last30Days.length > 0 && (
            <div>
              <div className="px-3 pb-1 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                Previous 30 Days
              </div>
              <div className="space-y-0.5">
                {chatGroups.last30Days.map(renderConversationItem)}
              </div>
            </div>
          )}

          {/* Older Group */}
          {chatGroups.older.length > 0 && (
            <div>
              <div className="px-3 pb-1 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                Older
              </div>
              <div className="space-y-0.5">
                {chatGroups.older.map(renderConversationItem)}
              </div>
            </div>
          )}

          {/* Empty State */}
          {conversations.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-zinc-500">
              {user?.provider === 'guest' ? (
                <span>
                  Guest session is ephemeral.<br />
                  <span className="text-zinc-600 dark:text-zinc-400">Chats are not saved to database.</span>
                </span>
              ) : (
                'No chats yet. Start a conversation!'
              )}
            </div>
          )}
        </div>

        {/* Powered by Groq footer badge */}
        <div className="px-3.5 py-2 border-t border-zinc-200 dark:border-[#212121] bg-zinc-50 dark:bg-[#101010] flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">Powered by Groq</span>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">LPU AI</span>
        </div>

        {/* User Card / Auth Footer & Settings */}
        <div className="p-3 border-t border-zinc-200 dark:border-[#212121] bg-zinc-100/70 dark:bg-[#0c0c0c]">
          {user && user.provider !== 'guest' ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.name}
                    className="w-8 h-8 rounded-full border border-zinc-300 dark:border-zinc-700 shrink-0 object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium text-zinc-900 dark:text-white truncate">{user.name}</span>
                  <span className="text-[10px] text-zinc-500 truncate">{user.email}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {onOpenSettings && (
                  <button
                    onClick={onOpenSettings}
                    className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition"
                    title="Settings & Tools"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={logout}
                  className="p-1.5 text-zinc-500 hover:text-rose-500 dark:text-zinc-400 dark:hover:text-rose-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : user && user.provider === 'guest' ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-xs text-zinc-700 dark:text-zinc-300 font-bold">
                    G
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-zinc-800 dark:text-zinc-300">Guest Mode</span>
                    <span className="text-[10px] text-zinc-500">Unsaved Session</span>
                  </div>
                </div>
                {onOpenSettings && (
                  <button
                    onClick={onOpenSettings}
                    className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition"
                    title="Settings & Tools"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setAuthModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white font-medium text-xs transition"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In to Save History</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAuthModalOpen(true)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign in / Sign up</span>
              </button>
              {onOpenSettings && (
                <button
                  onClick={onOpenSettings}
                  className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition"
                  title="Settings & Tools"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

