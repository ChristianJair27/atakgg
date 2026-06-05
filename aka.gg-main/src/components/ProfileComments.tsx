// src/components/ProfileComments.tsx — Community comments for a summoner profile
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { axiosInstance } from '@/lib/axios';
import { Heart, Trash2, MessageCircle, Send, ChevronDown, ChevronUp } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProfileComment {
  id: number;
  puuid: string;
  userId: number;
  username: string;
  content: string;
  likes: number;
  likedByMe: boolean;
  createdAt: string;
}

interface Props {
  puuid: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'ahora mismo';
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

function getStoredUser(): { id: number; username: string; role?: string } | null {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Map raw DB snake_case row → camelCase ProfileComment
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapComment(row: any): ProfileComment {
  return {
    id:        row.id,
    puuid:     row.profile_puuid ?? row.puuid ?? '',
    userId:    row.user_id   ?? row.userId,
    username:  row.user_name ?? row.username ?? '?',
    content:   row.content,
    likes:     row.likes_count ?? row.likes ?? 0,
    likedByMe: Boolean(row.liked_by_me ?? row.likedByMe),
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
  };
}

// ─── Single comment ───────────────────────────────────────────────────────────
const CommentItem = memo(function CommentItem({
  comment,
  currentUserId,
  onLike,
  onDelete,
}: {
  comment: ProfileComment;
  currentUserId: number | null;
  onLike: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const isOwn = currentUserId !== null && comment.userId === currentUserId;
  const initials = comment.username.slice(0, 2).toUpperCase();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
      className="group flex gap-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]
        hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-200"
    >
      {/* Avatar */}
      <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center
        bg-gradient-to-br from-red-700/60 to-red-900/40 border border-red-500/20 text-xs font-bold text-red-300">
        {initials}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-sm font-semibold text-white">{comment.username}</span>
          <span className="text-[11px] text-gray-600">{timeAgo(comment.createdAt)}</span>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed break-words">{comment.content}</p>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={() => onLike(comment.id)}
            className={`flex items-center gap-1.5 text-xs transition-colors ${
              comment.likedByMe
                ? 'text-red-400'
                : 'text-gray-600 hover:text-red-400'
            }`}
          >
            <Heart className={`h-3.5 w-3.5 ${comment.likedByMe ? 'fill-current' : ''}`} />
            {comment.likes > 0 && <span>{comment.likes}</span>}
          </button>

          {isOwn && (
            <button
              onClick={() => onDelete(comment.id)}
              className="flex items-center gap-1 text-xs text-gray-700 hover:text-red-500
                transition-colors opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="h-3 w-3" />
              Eliminar
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
});

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function CommentSkeleton() {
  return (
    <div className="flex gap-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse">
      <div className="w-9 h-9 rounded-full bg-white/[0.07] flex-shrink-0" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-3 bg-white/[0.07] rounded w-1/4" />
        <div className="h-3 bg-white/[0.05] rounded w-3/4" />
        <div className="h-3 bg-white/[0.05] rounded w-1/2" />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export const ProfileComments = memo(function ProfileComments({ puuid }: Props) {
  const [comments, setComments]   = useState<ProfileComment[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState(false);
  const [text, setText]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');
  const textareaRef               = useRef<HTMLTextAreaElement>(null);
  const currentUser               = getStoredUser();
  const isLoggedIn                = !!currentUser;

  const fetchComments = useCallback(() => {
    setLoading(true);
    axiosInstance.get<any>(`/api/stats/profile-comments/${puuid}`)
      .then(({ data }) => {
        const rows = Array.isArray(data) ? data : (Array.isArray(data?.comments) ? data.comments : []);
        setComments(rows.map(mapComment));
      })
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [puuid]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const handleLike = useCallback(async (id: number) => {
    if (!isLoggedIn) return;
    setComments(prev =>
      prev.map(c => c.id === id
        ? { ...c, likedByMe: !c.likedByMe, likes: c.likedByMe ? c.likes - 1 : c.likes + 1 }
        : c
      )
    );
    try {
      await axiosInstance.post(`/api/stats/profile-comments/${id}/like`);
    } catch {
      fetchComments(); // revert on error
    }
  }, [isLoggedIn, fetchComments]);

  const handleDelete = useCallback(async (id: number) => {
    setComments(prev => prev.filter(c => c.id !== id));
    try {
      await axiosInstance.delete(`/api/stats/profile-comments/${id}`);
    } catch {
      fetchComments();
    }
  }, [fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const { data } = await axiosInstance.post<any>(
        `/api/stats/profile-comments/${puuid}`,
        { content: text.trim() }
      );
      setComments(prev => [mapComment(data), ...prev]);
      setText('');
      textareaRef.current?.blur();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo publicar el comentario.');
    } finally {
      setSubmitting(false);
    }
  };

  const safeComments = Array.isArray(comments) ? comments : [];
  const visibleComments = expanded ? safeComments : safeComments.slice(0, 3);
  const hasMore = safeComments.length > 3;

  return (
    <section className="py-10 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-lg leading-none">Comentarios de la comunidad</h3>
            {!loading && (
              <p className="text-xs text-gray-500 mt-0.5">
                {safeComments.length} {safeComments.length === 1 ? 'comentario' : 'comentarios'}
              </p>
            )}
          </div>
        </div>

        {/* Compose box */}
        {isLoggedIn ? (
          <form onSubmit={handleSubmit} className="mb-6">
            <div className="relative rounded-xl border border-white/[0.08] bg-white/[0.03]
              focus-within:border-red-500/40 focus-within:bg-white/[0.05] transition-all duration-300">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(e as any); }}
                placeholder="Escribe un comentario sobre este jugador..."
                rows={2}
                maxLength={400}
                className="w-full bg-transparent px-4 pt-3 pb-2 text-sm text-gray-200
                  placeholder-gray-600 resize-none outline-none"
              />
              <div className="flex items-center justify-between px-4 pb-3">
                <span className="text-[11px] text-gray-700">{text.length}/400 · Ctrl+Enter para enviar</span>
                <button
                  type="submit"
                  disabled={submitting || !text.trim()}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold
                    bg-red-600 hover:bg-red-500 text-white disabled:opacity-40 disabled:cursor-not-allowed
                    transition-colors"
                >
                  {submitting
                    ? <div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    : <Send className="h-3.5 w-3.5" />
                  }
                  Publicar
                </button>
              </div>
            </div>
            {error && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="text-red-400 text-xs mt-2 px-1">
                {error}
              </motion.p>
            )}
          </form>
        ) : (
          <div className="mb-6 px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02]
            text-sm text-gray-500 text-center">
            <a href="/login" className="text-red-400 hover:underline">Inicia sesión</a> para dejar un comentario.
          </div>
        )}

        {/* Comments list */}
        <div className="space-y-2">
          {loading ? (
            [1, 2, 3].map(i => <CommentSkeleton key={i} />)
          ) : safeComments.length === 0 ? (
            <div className="text-center py-10 text-gray-600 text-sm">
              Nadie ha comentado aún. ¡Sé el primero!
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {visibleComments.map(c => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  currentUserId={currentUser?.id ?? null}
                  onLike={handleLike}
                  onDelete={handleDelete}
                />
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Show more / less */}
        {!loading && hasMore && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
              border border-white/[0.06] text-xs text-gray-500 hover:text-white
              hover:border-white/[0.12] hover:bg-white/[0.03] transition-all duration-200"
          >
            {expanded
              ? <><ChevronUp className="h-4 w-4" /> Mostrar menos</>
              : <><ChevronDown className="h-4 w-4" /> Ver los {safeComments.length - 3} comentarios restantes</>
            }
          </button>
        )}
      </div>
    </section>
  );
});
