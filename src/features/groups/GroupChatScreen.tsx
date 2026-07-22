import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Avatar } from '../../components/Avatar';
import { ThemeToggle } from '../../components/ThemeToggle';
import { Logo } from '../auth/LoginScreen';
import { fetchMessages, sendMessage, sendMediaMessage, fetchGroupById } from './groupApi';
import { GroupRow, MessageRow, MessageType } from '../../lib/types';

const EMOJIS = ['😀','😂','😍','👍','🎉','🔥','👏','🙏','😮','😢','🤔','💯','✅','❌','⭐','📚','✏️','🎓','💡','🚀'];

export function GroupChatScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const groupId = id!;

  const [group, setGroup] = useState<GroupRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [showEmojis, setShowEmojis] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showMenu, setShowMenu] = useState(false);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }, []);

  useEffect(() => {
    (async () => {
      const g = await fetchGroupById(groupId);
      setGroup(g);
      const msgs = await fetchMessages(groupId);
      setMessages(msgs);
      setLoading(false);
      scrollToBottom();
    })();
  }, [groupId, scrollToBottom]);

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` }, async (payload) => {
        const newMsg = payload.new as MessageRow;
        if (!newMsg.profile) {
          const { data: prof } = await supabase.from('profiles').select('id, name, username, email, role, created_at').eq('id', newMsg.user_id).maybeSingle();
          newMsg.profile = prof as any;
        }
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        scrollToBottom();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId, scrollToBottom]);

  const onSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;
    setBusy(true);
    const err = await sendMessage(groupId, input);
    setBusy(false);
    if (err) setError(err); else setInput('');
  };

  const onEmoji = (emoji: string) => {
    setInput((prev) => prev + emoji);
    setShowEmojis(false);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const type: MessageType = isImage ? 'image' : isVideo ? 'video' : 'file';
    setBusy(true);
    const err = await sendMediaMessage(groupId, file, type as 'image' | 'file' | 'video');
    setBusy(false);
    if (err) setError(err);
    e.target.value = '';
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-3 bg-ink-50 dark:bg-ink-800">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        <p className="text-sm text-ink-500">Loading chat…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-ink-50 dark:bg-ink-800">
      <header className="z-20 flex items-center justify-between border-b border-ink-200 bg-white px-4 py-3 dark:border-ink-700 dark:bg-ink-700/60">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/groups')} className="tb-btn-ghost" aria-label="Back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>
          <Avatar name={group?.name || 'Group'} size={32} />
          <div><p className="font-semibold">{group?.name}</p><p className="text-xs text-ink-500">{messages.length} messages</p></div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button onClick={signOut} className="tb-btn-secondary text-xs">Sign out</button>
        </div>
      </header>

      <div ref={scrollRef} className="chat-scroll flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-2xl space-y-3">
          {messages.length === 0 && <div className="mt-8 text-center text-sm text-ink-400">No messages yet. Start the conversation!</div>}
          {messages.map((m) => {
            const isMe = m.user_id === profile?.id;
            const name = m.profile?.name || 'Unknown';
            return <MessageBubble key={m.id} message={m} isMe={isMe} name={name} />;
          })}
        </div>
      </div>

      {error && <div className="mx-auto max-w-2xl px-4"><div className="mb-2 rounded-lg bg-danger/10 px-3 py-1.5 text-xs text-danger">{error}</div></div>}

      <div className="border-t border-ink-200 bg-white px-4 py-3 dark:border-ink-700 dark:bg-ink-700/60">
        <form onSubmit={onSend} className="mx-auto flex max-w-2xl items-center gap-2">
          <button type="button" onClick={() => setShowEmojis((v) => !v)} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-600" aria-label="Emoji">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-600" aria-label="Attach file">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx" className="hidden" onChange={onFile} />
          <input className="tb-input" placeholder="Type a message…" value={input} onChange={(e) => setInput(e.target.value)} disabled={busy} />
          <button type="submit" disabled={busy || !input.trim()} className="tb-btn-primary shrink-0" aria-label="Send">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
          </button>
        </form>
        {showEmojis && (
          <div className="mx-auto mt-2 flex max-w-2xl flex-wrap gap-1 rounded-lg border border-ink-200 bg-white p-2 dark:border-ink-700 dark:bg-ink-700">
            {EMOJIS.map((e) => <button key={e} onClick={() => onEmoji(e)} className="grid h-8 w-8 place-items-center rounded text-lg hover:bg-ink-100 dark:hover:bg-ink-600">{e}</button>)}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message, isMe, name }: { message: MessageRow; isMe: boolean; name: string }) {
  const time = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (message.message_type === 'image' && message.media_url) {
    return (
      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-xs ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
          {!isMe && <span className="mb-0.5 text-xs text-ink-500">{name}</span>}
          <img src={message.media_url} alt={message.media_name || 'image'} className="rounded-xl border border-ink-200 shadow-soft dark:border-ink-700" style={{ maxHeight: 300 }} />
          <span className="mt-0.5 text-[10px] text-ink-400">{time}</span>
        </div>
      </div>
    );
  }

  if (message.message_type === 'video' && message.media_url) {
    return (
      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-sm ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
          {!isMe && <span className="mb-0.5 text-xs text-ink-500">{name}</span>}
          <video src={message.media_url} controls className="rounded-xl border border-ink-200 shadow-soft dark:border-ink-700" style={{ maxHeight: 300 }} />
          <span className="mt-0.5 text-[10px] text-ink-400">{time}</span>
        </div>
      </div>
    );
  }

  if (message.message_type === 'file' && message.media_url) {
    return (
      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-xs ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
          {!isMe && <span className="mb-0.5 text-xs text-ink-500">{name}</span>}
          <a href={message.media_url} target="_blank" rel="noreferrer" download={message.media_name || undefined} className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm hover:bg-ink-100 dark:border-ink-700 dark:bg-ink-700 dark:hover:bg-ink-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            <span className="truncate">{message.media_name || 'File'}</span>
          </a>
          <span className="mt-0.5 text-[10px] text-ink-400">{time}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-md ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
        {!isMe && <span className="mb-0.5 text-xs text-ink-500">{name}</span>}
        <div className={`rounded-2xl px-3 py-2 text-sm ${isMe ? 'bg-brand-500 text-white' : 'bg-white border border-ink-200 text-ink-800 dark:bg-ink-700 dark:border-ink-600 dark:text-ink-100'}`}>
          {message.content}
        </div>
        <span className="mt-0.5 text-[10px] text-ink-400">{time}</span>
      </div>
    </div>
  );
}
