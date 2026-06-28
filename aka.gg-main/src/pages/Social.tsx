// src/pages/Social.tsx — glass/space · React Query · optimistic likes/comments/posts
import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, MessageSquare, Trash2, Send, Users,
  Zap, Trophy, HelpCircle, Video, Star, ChevronDown,
  RefreshCw, Lock, Plus,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ScrollVideoBg } from '@/components/ScrollVideoBg';
import { Skeleton } from '@/components/ui/skeleton';
import { Tip } from '@/components/ui/Tip';
import {
  useFeed, flattenFeed, useToggleLike, useCreatePost, useDeletePost,
  useComments, useAddComment, useDeleteComment,
  type Post, type Comment,
} from '@/hooks/queries/social';

// ─── Tag config ───────────────────────────────────────────────────────────────
const TAGS = [
  { key:'general',   label:'General',    icon:<Star className="h-3.5 w-3.5"/>,      color:'text-gray-300 border-gray-600/40 bg-gray-500/10' },
  { key:'highlight', label:'Highlight',  icon:<Zap className="h-3.5 w-3.5"/>,       color:'text-yellow-300 border-yellow-500/40 bg-yellow-500/10' },
  { key:'lfg',       label:'LFG',        icon:<Users className="h-3.5 w-3.5"/>,     color:'text-green-300 border-green-500/40 bg-green-500/10' },
  { key:'ayuda',     label:'Ayuda',      icon:<HelpCircle className="h-3.5 w-3.5"/>,color:'text-blue-300 border-blue-500/40 bg-blue-500/10' },
  { key:'clip',      label:'Clip',       icon:<Video className="h-3.5 w-3.5"/>,     color:'text-purple-300 border-purple-500/40 bg-purple-500/10' },
  { key:'torneo',    label:'Torneo',     icon:<Trophy className="h-3.5 w-3.5"/>,    color:'text-red-300 border-red-500/40 bg-red-500/10' },
] as const;

type TagKey = typeof TAGS[number]['key'];

function tagConfig(key: string) {
  return TAGS.find(t => t.key === key) ?? TAGS[0];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(dt: string) {
  const diff = (Date.now() - new Date(dt).getTime()) / 1000;
  if (diff < 60)   return 'ahora';
  if (diff < 3600) return `${Math.floor(diff/60)}m`;
  if (diff < 86400)return `${Math.floor(diff/3600)}h`;
  return `${Math.floor(diff/86400)}d`;
}

function getUser(): { name: string; id?: number } | null {
  try {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  } catch { return null; }
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, size=9 }: { name: string; size?: number }) {
  // ATAK palette — red family + warm neutrals + gold (no purple/blue/cyan AI-tells)
  const colors = ['from-red-700 to-red-900','from-rose-800 to-red-950',
    'from-zinc-700 to-zinc-900','from-stone-700 to-stone-900','from-amber-700 to-amber-900'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`w-${size} h-${size} rounded-xl bg-gradient-to-br ${color}
      border border-white/[0.12] flex items-center justify-center text-sm font-black text-white flex-shrink-0`}>
      {name[0]?.toUpperCase()}
    </div>
  );
}

// ─── Tag pill ─────────────────────────────────────────────────────────────────
function TagPill({ tag }: { tag: string }) {
  const cfg = tagConfig(tag);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

// ─── Comment item ─────────────────────────────────────────────────────────────
function CommentItem({ c, myId, onDelete }: { c: Comment; myId?: number; onDelete:(id:number)=>void }) {
  return (
    <div className="flex gap-3">
      <Avatar name={c.user_name} size={7} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-gray-300">{c.user_name}</span>
          <span className="text-xs text-gray-600">{timeAgo(c.created_at)}</span>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed">{c.content}</p>
      </div>
      {myId === c.user_id && (
        <button onClick={() => onDelete(c.id)}
          className="text-gray-700 hover:text-red-400 transition-colors flex-shrink-0 mt-1">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Post card ────────────────────────────────────────────────────────────────
function PostCard({
  post, myUserId, onLike, onDelete, feedTag,
}: {
  post: Post; myUserId?: number;
  onLike: (post: Post)=>void;
  onDelete: (id:number)=>void;
  feedTag: string;
}) {
  const [showComments,  setShowComments]  = useState(false);
  const [newComment,    setNewComment]    = useState('');
  const isAuth = !!localStorage.getItem('access_token');

  // Like state is read straight from the optimistically-updated cache.
  const liked      = post.liked_by_me;
  const likesCount = post.likes_count;

  const commentsQ   = useComments(post.id, showComments);
  const comments    = commentsQ.data ?? [];
  const loadingC    = commentsQ.isLoading;
  const addComment  = useAddComment(post.id, feedTag);
  const delComment  = useDeleteComment(post.id);

  const toggleComments = () => setShowComments(v => !v);

  const handleLike = () => {
    if (!isAuth) return;
    onLike(post); // optimistic in the feed cache
  };

  const submitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !isAuth) return;
    addComment.mutate(newComment.trim(), { onSuccess: () => setNewComment('') });
  };

  const deleteComment = (cid: number) => delComment.mutate(cid);
  const sendingC = addComment.isPending;

  return (
    <div className="rounded-2xl transition-all duration-200 overflow-hidden group hover:-translate-y-0.5"
      style={{
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 22%, rgba(255,255,255,0) 70%), rgba(13,13,17,0.30)',
        backdropFilter: 'blur(20px) saturate(120%)',
        WebkitBackdropFilter: 'blur(20px) saturate(120%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 44px -30px rgba(0,0,0,.6)',
      }}>
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <Avatar name={post.user_name} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white text-sm">{post.user_name}</span>
              <TagPill tag={post.tag} />
              <span className="text-gray-600 text-xs ml-auto">{timeAgo(post.created_at)}</span>
            </div>
          </div>
          {myUserId === post.user_id && (
            <Tip label="Eliminar publicación">
              <button onClick={() => onDelete(post.id)}
                className="text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0">
                <Trash2 className="h-4 w-4" />
              </button>
            </Tip>
          )}
        </div>

        {/* Content */}
        <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap mb-4">{post.content}</p>

        {/* Actions */}
        <div className="flex items-center gap-5 pt-2 border-t border-white/[0.05]">
          <Tip label={liked ? 'Quitar me gusta' : 'Me gusta'}>
            <button onClick={handleLike}
              disabled={!isAuth}
              className={`flex items-center gap-1.5 text-sm transition-all duration-200 ${
                liked ? 'text-red-400 scale-110' : 'text-gray-500 hover:text-red-400'
              } disabled:cursor-default`}>
              <Heart className={`h-4 w-4 transition-all ${liked ? 'fill-red-400' : ''}`} />
              <span className="font-medium">{likesCount}</span>
            </button>
          </Tip>

          <Tip label="Ver comentarios">
            <button onClick={toggleComments}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-400 transition-colors">
              <MessageSquare className="h-4 w-4" />
              <span className="font-medium">{post.comments_count}</span>
            </button>
          </Tip>
        </div>
      </div>

      {/* Comments section */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="border-t border-white/[0.06] bg-white/[0.02] overflow-hidden"
          >
            <div className="p-5 space-y-4">
              {loadingC && (
                <div className="space-y-3">
                  {[0, 1].map(i => (
                    <div key={i} className="flex gap-3">
                      <Skeleton variant="circle" width={28} height={28} />
                      <div className="flex-1 space-y-2">
                        <Skeleton width="30%" height={12} />
                        <Skeleton width="80%" height={12} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {comments.map(c => (
                <CommentItem key={c.id} c={c} myId={myUserId} onDelete={deleteComment} />
              ))}
              {comments.length === 0 && !loadingC && (
                <p className="text-gray-600 text-sm text-center py-2">Sé el primero en comentar</p>
              )}

              {isAuth ? (
                <form onSubmit={submitComment} className="flex gap-3 pt-2">
                  <input
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Escribe un comentario..."
                    maxLength={280}
                    className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5
                      text-sm text-white placeholder:text-gray-700 outline-none
                      focus:border-red-500/50 transition-colors"
                  />
                  <button type="submit" disabled={!newComment.trim() || sendingC}
                    className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white
                      transition-all disabled:opacity-40 flex items-center gap-1.5 text-sm font-semibold">
                    {sendingC ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </form>
              ) : (
                <p className="text-gray-600 text-sm text-center">
                  <Link to="/login" className="text-red-400 hover:underline">Inicia sesión</Link> para comentar
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Compose box ──────────────────────────────────────────────────────────────
function ComposeBox({ feedTag }: { feedTag: string }) {
  const [content,  setContent]  = useState('');
  const [tag,      setTag]      = useState<TagKey>('general');
  const [focused,  setFocused]  = useState(false);
  const user = getUser();
  const createPost = useCreatePost(feedTag);
  const loading = createPost.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    // Optimistic: the new post appears instantly via useCreatePost.onMutate.
    createPost.mutate(
      { content: content.trim(), tag },
      { onSuccess: () => setContent('') },
    );
  };

  return (
    <div className={`rounded-2xl transition-all duration-300 mb-6 overflow-hidden ${
      focused ? 'shadow-[0_0_30px_rgba(239,68,68,0.16)]' : ''
    }`}
      style={{
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 22%, rgba(255,255,255,0) 70%), rgba(13,13,17,0.30)',
        backdropFilter: 'blur(20px) saturate(120%)',
        WebkitBackdropFilter: 'blur(20px) saturate(120%)',
        boxShadow: focused
          ? 'inset 0 1px 0 rgba(255,255,255,0.05), 0 0 30px rgba(239,68,68,0.16)'
          : 'inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 44px -30px rgba(0,0,0,.6)',
      }}>
      <form onSubmit={submit}>
        <div className="p-5">
          <div className="flex gap-3">
            {user && <Avatar name={user.name} />}
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Comparte tu highlight, busca teammates, pide ayuda..."
              maxLength={280}
              rows={focused || content ? 3 : 1}
              className="flex-1 bg-transparent text-white placeholder:text-gray-600 text-sm
                resize-none outline-none leading-relaxed transition-all duration-200"
            />
          </div>
        </div>

        <AnimatePresence>
          {(focused || content) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-white/[0.06] px-5 py-3 flex items-center justify-between gap-4 overflow-hidden"
            >
              {/* Tag selector */}
              <div className="flex flex-wrap gap-1.5">
                {TAGS.map(t => (
                  <button key={t.key} type="button" onClick={() => setTag(t.key)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border font-medium
                      transition-all ${tag === t.key ? t.color : 'border-white/[0.06] text-gray-600 hover:text-gray-400'}`}>
                    {t.icon}{t.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-xs ${content.length > 240 ? 'text-red-400' : 'text-gray-600'}`}>
                  {content.length}/280
                </span>
                <button type="submit" disabled={!content.trim() || loading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500
                    text-white text-sm font-bold transition-all disabled:opacity-40
                    shadow-[0_0_16px_rgba(239,68,68,0.25)]">
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Publicar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Social() {
  const [tagFilter,   setTagFilter]   = useState('all');
  const [mousePos,    setMousePos]    = useState({ x:0, y:0 });
  const headerRef = useRef<HTMLDivElement>(null);
  const user   = getUser();
  const isAuth = !!localStorage.getItem('access_token');

  // Paginated feed via React Query (caching + dedupe). Filtering by tag swaps
  // the query key, so each filter keeps its own cache.
  const feed = useFeed(tagFilter);
  const posts = flattenFeed(feed.data?.pages);
  const loading = feed.isLoading;
  const loadingMore = feed.isFetchingNextPage;
  const hasMore = feed.hasNextPage;

  const toggleLike = useToggleLike(tagFilter);
  const deletePost = useDeletePost(tagFilter);

  useEffect(() => {
    if (loading || !headerRef.current) return;
    gsap.fromTo(headerRef.current.querySelectorAll('[data-h]'),
      { opacity:0, y:25 },
      { opacity:1, y:0, stagger:0.1, duration:0.65, ease:'power2.out' }
    );
  }, [loading]);

  const handleLike = (post: Post) => toggleLike.mutate(post);

  const handleDelete = (postId: number) => {
    if (!confirm('¿Eliminar esta publicación?')) return;
    deletePost.mutate(postId);
  };

  const ALL_TAGS = [{ key:'all', label:'Todo', icon:<Star className="h-3.5 w-3.5"/> }, ...TAGS];

  return (
    <div className="min-h-screen text-white"
      onMouseMove={e => setMousePos({ x:e.clientX, y:e.clientY })}>
      {/* Living scroll-scrubbed dagger background (shared) */}
      <ScrollVideoBg />
      <div className="fixed inset-0 -z-10 pointer-events-none"
        style={{ background:'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(29,78,127,0.16) 0%, transparent 60%)' }} />
      <div className="fixed inset-0 pointer-events-none -z-10"
        style={{ background:`radial-gradient(450px circle at ${mousePos.x}px ${mousePos.y}px, rgba(59,130,246,0.05), transparent 70%)` }} />
      <div className="fixed inset-0 -z-10 opacity-[0.025]"
        style={{ backgroundImage:'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)', backgroundSize:'60px 60px' }} />

      <div className="max-w-2xl mx-auto px-4 py-14 relative z-[1]">

        {/* Header */}
        <div ref={headerRef} className="text-center mb-10">
          <div data-h className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6
            bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm">
            <Users className="h-4 w-4" />
            <span>Comunidad ATAK.GG</span>
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          </div>
          <h1 data-h className="text-4xl md:text-5xl font-black text-white mb-3">
            Feed <span className="text-blue-400 [text-shadow:0_0_40px_rgba(59,130,246,0.5)]">Social</span>
          </h1>
          <p data-h className="text-gray-400">
            Comparte highlights, busca duo, pide consejos y conecta con la comunidad.
          </p>
        </div>

        {/* Compose or login prompt */}
        {isAuth ? (
          <ComposeBox feedTag={tagFilter} />
        ) : (
          <div className="rounded-2xl p-6 text-center mb-6"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 70%), rgba(13,13,17,0.30)',
              backdropFilter: 'blur(20px) saturate(120%)',
              WebkitBackdropFilter: 'blur(20px) saturate(120%)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 44px -30px rgba(0,0,0,.6)',
            }}>
            <Lock className="h-8 w-8 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm mb-4">Inicia sesión para publicar en la comunidad</p>
            <Link to="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500
                text-white text-sm font-bold transition-all">
              <Plus className="h-4 w-4" /> Iniciar sesión
            </Link>
          </div>
        )}

        {/* Tag filter pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {ALL_TAGS.map(t => (
            <Tip key={t.key} label={`Filtrar: ${t.label}`}>
              <button onClick={() => setTagFilter(t.key)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold
                  border transition-all duration-200 ${
                  tagFilter === t.key
                    ? 'bg-white/[0.1] border-white/30 text-white'
                    : 'border-white/[0.06] text-gray-500 hover:text-gray-300 hover:border-white/[0.12]'
                }`}>
                {t.icon}{t.label}
              </button>
            </Tip>
          ))}
        </div>

        {/* Feed */}
        {loading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                <div className="flex gap-3 mb-4">
                  <Skeleton variant="circle" width={36} height={36} style={{ borderRadius: 12 }} />
                  <div className="flex-1 space-y-2">
                    <Skeleton width="33%" height={12} />
                    <Skeleton width="25%" height={12} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Skeleton width="100%" height={12} />
                  <Skeleton width="83%" height={12} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {posts.length > 0 ? (
              <div className="space-y-4">
                {posts.map((post, i) => (
                  <motion.div key={post.id}
                    initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
                    exit={{ opacity:0, scale:0.95 }}
                    transition={{ duration:0.3, delay: i < 5 ? i * 0.06 : 0 }}>
                    <PostCard
                      post={post}
                      myUserId={user?.id}
                      onLike={handleLike}
                      onDelete={handleDelete}
                      feedTag={tagFilter}
                    />
                  </motion.div>
                ))}

                {/* Load more */}
                {hasMore && (
                  <div className="text-center pt-4">
                    <button
                      onClick={() => feed.fetchNextPage()}
                      disabled={loadingMore}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold
                        border border-white/[0.08] text-gray-400 hover:text-white hover:border-white/20
                        transition-all disabled:opacity-50">
                      {loadingMore
                        ? <><RefreshCw className="h-4 w-4 animate-spin"/> Cargando...</>
                        : <><ChevronDown className="h-4 w-4"/> Cargar más</>
                      }
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
                className="text-center py-20">
                <Users className="h-16 w-16 text-gray-800 mx-auto mb-4" />
                <p className="text-gray-500 text-lg mb-2">No hay publicaciones aún</p>
                {isAuth && (
                  <p className="text-gray-600 text-sm">¡Sé el primero en publicar algo!</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
