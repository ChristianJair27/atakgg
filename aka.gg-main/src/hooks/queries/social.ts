// Social feed query + optimistic mutation hooks — wrap /api/social/* endpoints.
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { toast } from "sonner";
import { qk } from "./keys";

export interface Post {
  id: number;
  user_id: number;
  user_name: string;
  content: string;
  tag: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  liked_by_me: boolean;
}

export interface Comment {
  id: number;
  user_id: number;
  user_name: string;
  content: string;
  created_at: string;
}

interface FeedPage {
  posts: Post[];
  pages: number;
  page: number;
}

// ── Feed (paginated) ─────────────────────────────────────────────────────────
// Social is more volatile than stats, so a shorter staleTime.
export function useFeed(tag: string) {
  return useInfiniteQuery({
    queryKey: qk.social.feed(tag),
    initialPageParam: 1,
    staleTime: 15_000,
    queryFn: async ({ pageParam }) => {
      const { data } = await axiosInstance.get("/api/social/posts", {
        params: { page: pageParam, limit: 20, tag },
      });
      return { posts: data.posts ?? [], pages: data.pages ?? 1, page: pageParam } as FeedPage;
    },
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined),
  });
}

// Flatten infinite-query pages into a single post list.
export function flattenFeed(pages?: { posts: Post[] }[]): Post[] {
  return (pages ?? []).flatMap((p) => p.posts);
}

// Helper: walk every post across every page and apply `fn`.
function mapPostsInCache(
  qc: ReturnType<typeof useQueryClient>,
  tag: string,
  fn: (p: Post) => Post,
) {
  qc.setQueryData<{ pages: FeedPage[]; pageParams: unknown[] }>(qk.social.feed(tag), (old) => {
    if (!old) return old;
    return {
      ...old,
      pages: old.pages.map((pg) => ({ ...pg, posts: pg.posts.map(fn) })),
    };
  });
}

// ── Like / unlike (optimistic) ───────────────────────────────────────────────
export function useToggleLike(tag: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (post: Post) => {
      await axiosInstance.post(`/api/social/posts/${post.id}/like`);
    },
    onMutate: async (post) => {
      await qc.cancelQueries({ queryKey: qk.social.feed(tag) });
      const prev = qc.getQueryData(qk.social.feed(tag));
      mapPostsInCache(qc, tag, (p) =>
        p.id === post.id
          ? {
              ...p,
              liked_by_me: !p.liked_by_me,
              likes_count: p.likes_count + (p.liked_by_me ? -1 : 1),
            }
          : p,
      );
      return { prev };
    },
    onError: (_e, _post, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.social.feed(tag), ctx.prev);
      toast.error("No se pudo registrar el like");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.social.feed(tag) }),
  });
}

// ── Create post (optimistic) ─────────────────────────────────────────────────
export function useCreatePost(tag: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { content: string; tag: string }) => {
      const { data } = await axiosInstance.post<Post>("/api/social/posts", input);
      return data;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: qk.social.feed(tag) });
      const prev = qc.getQueryData(qk.social.feed(tag));
      // Only show the optimistic post if it would belong in the current filter.
      if (tag === "all" || tag === input.tag) {
        const me = (() => {
          try {
            return JSON.parse(localStorage.getItem("user") || "null");
          } catch {
            return null;
          }
        })();
        const optimistic: Post = {
          id: -Date.now(), // temp negative id
          user_id: me?.id ?? 0,
          user_name: me?.name ?? "Tú",
          content: input.content,
          tag: input.tag,
          likes_count: 0,
          comments_count: 0,
          created_at: new Date().toISOString(),
          liked_by_me: false,
        };
        qc.setQueryData<{ pages: FeedPage[]; pageParams: unknown[] }>(qk.social.feed(tag), (old) => {
          if (!old || !old.pages.length) return old;
          const [first, ...rest] = old.pages;
          return { ...old, pages: [{ ...first, posts: [optimistic, ...first.posts] }, ...rest] };
        });
      }
      return { prev };
    },
    onError: (_e, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.social.feed(tag), ctx.prev);
      toast.error("No se pudo publicar");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.social.feed(tag) }),
  });
}

// ── Delete post (optimistic) ─────────────────────────────────────────────────
export function useDeletePost(tag: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: number) => {
      await axiosInstance.delete(`/api/social/posts/${postId}`);
    },
    onMutate: async (postId) => {
      await qc.cancelQueries({ queryKey: qk.social.feed(tag) });
      const prev = qc.getQueryData(qk.social.feed(tag));
      qc.setQueryData<{ pages: FeedPage[]; pageParams: unknown[] }>(qk.social.feed(tag), (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((pg) => ({ ...pg, posts: pg.posts.filter((p) => p.id !== postId) })),
        };
      });
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.social.feed(tag), ctx.prev);
      toast.error("No se pudo eliminar la publicación");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.social.feed(tag) }),
  });
}

// ── Comments ─────────────────────────────────────────────────────────────────
export function useComments(postId: number, enabled: boolean) {
  return useQuery({
    queryKey: qk.social.comments(postId),
    enabled,
    queryFn: async () => {
      const { data } = await axiosInstance.get<Comment[]>(`/api/social/posts/${postId}/comments`);
      return data;
    },
  });
}

export function useAddComment(postId: number, feedTag: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) => {
      const { data } = await axiosInstance.post<Comment>(
        `/api/social/posts/${postId}/comments`,
        { content },
      );
      return data;
    },
    onSuccess: (comment) => {
      // Append the real comment to the cached list.
      qc.setQueryData<Comment[]>(qk.social.comments(postId), (old) =>
        old ? [...old, comment] : [comment],
      );
      // Bump the post's comment counter in the feed.
      mapPostsInCache(qc, feedTag, (p) =>
        p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p,
      );
    },
    onError: () => toast.error("No se pudo comentar"),
  });
}

export function useDeleteComment(postId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: number) => {
      await axiosInstance.delete(`/api/social/comments/${commentId}`);
      return commentId;
    },
    onMutate: async (commentId) => {
      await qc.cancelQueries({ queryKey: qk.social.comments(postId) });
      const prev = qc.getQueryData<Comment[]>(qk.social.comments(postId));
      qc.setQueryData<Comment[]>(qk.social.comments(postId), (old) =>
        (old ?? []).filter((c) => c.id !== commentId),
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.social.comments(postId), ctx.prev);
      toast.error("No se pudo eliminar el comentario");
    },
  });
}
