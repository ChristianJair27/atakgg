# ATAK.GG Frontend Conventions

Standards for the React + Vite + TS + Tailwind app in `aka.gg-main`. Apply these
to **all new and edited pages/components** so the app stays fast, consistent and
on-brand. Do **not** touch `backend`, `electron`, or `overwolf`.

---

## 1. Data fetching — always React Query

**Never** fetch with raw `useEffect` + `axiosInstance` inside a component. Always
write (or reuse) a typed hook under `src/hooks/queries/` and call that.

- Endpoints are wrapped, never changed.
- Co-locate hooks by domain: `tournaments.ts`, `players.ts`, `social.ts`, `stats.ts`.
- Query keys come from the factory in `src/hooks/queries/keys.ts` (`qk.*`) — never
  hand-write key arrays inline, so invalidation stays consistent.
- Dependent fetches use `enabled:` (e.g. resolve `riotId → puuid`, then fetch
  `summary` only once `puuid` exists). Wrap each step as its own query; don't
  collapse a multi-step flow into one giant `queryFn`.

```ts
// src/hooks/queries/tournaments.ts
export function useTournaments() {
  return useQuery({
    queryKey: qk.tournaments(),
    queryFn: async () => {
      const { data } = await axiosInstance.get<Tournament[]>("/api/tournaments");
      return Array.isArray(data) ? data : [];
    },
  });
}
```

### Caching defaults

Set globally in `src/lib/queryClient.ts`:

```ts
staleTime: 60_000,          // 1 min — data treated as fresh
gcTime:    5 * 60_000,      // 5 min — unused cache retained
refetchOnWindowFocus: false,
retry: 1,
```

Override per-query where appropriate:
- Slow-moving Riot data (resolve, summary, finished match stats): `staleTime: 10 * 60_000`.
- Volatile data (social feed): `staleTime: 15_000`.

---

## 2. Loading — content-shaped skeletons

Use `<Skeleton>` from `@/components/ui/skeleton`, shaped like the content it
replaces (cards, rows, stat blocks) so the layout never jumps. **Never** a bare
spinner / "Cargando…" for panel-level loading.

The only place a spinner-style/global loader is acceptable is the big initial
route loader (the 3D Kata loader on `ProfilePage` / `MatchDetailPage` while the
invocador/partida resolves).

```tsx
import { Skeleton } from "@/components/ui/skeleton";

// variants: "line" | "block" | "circle"; props: width, height, count
{isLoading
  ? <Skeleton variant="block" height={96} count={3} />
  : <RealCards data={data} />}
```

Legacy `<Skeleton className="h-4 w-20" />` (Tailwind sizing) still works.

---

## 3. Mutations — optimistic, with rollback + invalidate

All mutations use `useMutation` with the optimistic pattern, and report failures
with a **sonner** toast:

```ts
useMutation({
  mutationFn: (input) => axiosInstance.post(url, input),
  onMutate: async (input) => {
    await qc.cancelQueries({ queryKey });
    const prev = qc.getQueryData(queryKey);
    qc.setQueryData(queryKey, /* optimistic next state */);
    return { prev };                              // snapshot for rollback
  },
  onError: (_e, _input, ctx) => {
    if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev); // rollback
    toast.error("Mensaje claro en español");
  },
  onSettled: () => qc.invalidateQueries({ queryKey }), // reconcile with server
});
```

Examples live in `src/hooks/queries/social.ts` (`useToggleLike`, `useCreatePost`,
`useDeletePost`, `useAddComment`, `useDeleteComment`). After non-optimistic
mutations (e.g. tournament register/create, account link) at minimum
`invalidateQueries` the affected key so caches stay correct.

---

## 4. Tooltips — wrap icon-only / abbreviated UI

Use `<Tip label="…">` from `@/components/ui/Tip` (a terse Radix wrapper) on
icon-only buttons and abbreviated/stat UI: KDA, KP, CS·min, vision, rank emblems,
"Actualizar", filter chips, like/comment/delete icons, win-loss bars, etc.
Labels are in **Spanish**.

```tsx
import { Tip } from "@/components/ui/Tip";

<Tip label="Actualizar perfil">
  <button onClick={refresh}><RefreshCw /></button>
</Tip>
```

`<Tip>` uses Radix `asChild`, so the child must be a single DOM element (button,
div, span, anchor). It does **not** work wrapping a custom component that doesn't
forward refs/props (e.g. the `Panel` motion wrapper) — in that case put the `Tip`
**inside** the component around a plain element. The single global
`<TooltipProvider>` is mounted in `App.tsx`; don't add another.

---

## 5. ATAK design tokens

| Token        | Value                     | Use                          |
|--------------|---------------------------|------------------------------|
| Background   | `#0a0a0c`                 | page background              |
| Red (brand)  | `#e1242e` / hover `#ff5a64`| primary actions, accents     |
| Win          | `#2fbf8a`                 | victories, positive stats    |
| Loss         | `#ff5a64`                 | defeats, negative stats      |
| Gold         | `#c8aa6e`                 | rank / prestige              |
| Fonts        | `Saira`, `Saira Condensed`| body / condensed headings    |

Panels are **translucent glass**, not opaque cards, so the living dagger video
background (`<ScrollVideoBg/>`) reads through:

```css
background: linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 22%, rgba(255,255,255,0) 70%), rgba(13,13,17,0.30);
backdrop-filter: blur(20px) saturate(120%);
box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 44px -30px rgba(0,0,0,.6);
border-radius: 18px;
```

UI copy is in Spanish. Keep the glass + living-video aesthetic intact.

---

## Checklist for new work

- [ ] Data via a `src/hooks/queries/` hook + `qk.*` key (no raw `useEffect` fetch).
- [ ] Loading rendered as a content-shaped `<Skeleton>`.
- [ ] Mutations optimistic (`onMutate`/rollback/`onSettled` invalidate) + sonner toast.
- [ ] Icon-only / abbreviated UI wrapped in `<Tip>` (Spanish labels).
- [ ] Brand tokens + glass surfaces; Spanish copy.
- [ ] `npx vite build` passes.
